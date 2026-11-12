#!/usr/bin/env bash
# ============================================================================
# mp-v2 infra — поднятие compose-стека и ожидание healthcheck'ов.
# Дубль up.ps1 для CI/Unix (задача 0.3).
#
#   1) валидация:  docker compose config -q
#   2) поднятие:   docker compose up -d
#   3) ожидание health всех сервисов (TIMEOUT, по умолчанию 600 с)
#   4) таблица: сервис / статус / порт(ы)
#
# Пути резолвятся относительно скрипта — работает и из корня, и из infra/.
# Если .env нет — используется .env.example (dev-креды).
# Аргументы: --no-nginx (не поднимать nginx, пока нет web/gateway — 0.7)
# Переменные: TIMEOUT (сек, дефолт 600)
# ============================================================================
set -euo pipefail

INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$INFRA_DIR")"
COMPOSE_FILE="$INFRA_DIR/docker-compose.yml"
TIMEOUT="${TIMEOUT:-600}"

if [ -f "$REPO_ROOT/.env" ]; then
  ENV_FILE="$REPO_ROOT/.env"
else
  ENV_FILE="$REPO_ROOT/.env.example"
  echo "[up] .env не найден — использую .env.example (dev-креды)"
fi

NO_NGINX=0
for arg in "$@"; do
  case "$arg" in
    --no-nginx) NO_NGINX=1 ;;
    *) echo "неизвестный аргумент: $arg" >&2; exit 2 ;;
  esac
done

compose() { docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }

# --- TLS: на свежем клоне сертификатов *.mp-kit.local нет (в .gitignore) ----
if [ ! -f "$INFRA_DIR/nginx/tls/fullchain.pem" ]; then
  echo "[up] TLS-сертификатов нет — генерирую dev CA (*.mp-kit.local)…"
  bash "$INFRA_DIR/nginx/tls/generate.sh"
fi

echo "[up] 1/3 — валидация compose-конфига (config -q)…"
compose config -q

# Ожидаемые сервисы (все, без неактивных профилей)
EXPECTED="$(compose config --services | tr '\n' ' ')"
if [ "$NO_NGINX" = 1 ]; then
  EXPECTED="$(echo "$EXPECTED" | tr ' ' '\n' | grep -v '^nginx$' | tr '\n' ' ')"
fi

echo "[up] 2/3 — docker compose up -d…"
if [ "$NO_NGINX" = 1 ]; then
  # shellcheck disable=SC2086
  compose up -d $EXPECTED
else
  compose up -d
fi

echo "[up] 3/3 — ожидание health (таймаут ${TIMEOUT} с)…"
STARTED="$(date +%s)"
DEADLINE=$((STARTED + TIMEOUT))
LAST_SHOUT=0
PENDING=""

# "svc|status|state" для каждой строки compose ps --format json (JSON-п строки)
ps_lines() {
  compose ps -a --format json 2>/dev/null | tr -d '\r'
}

is_ready() { # $1=status $2=state
  local status="$1" state="$2"
  case "$status" in *"(healthy)"*) return 0 ;; esac
  if [ "$state" = "exited" ]; then
    case "$status" in "Exited (0)"*) return 0 ;; esac
  fi
  return 1
}

while :; do
  NOW="$(date +%s)"
  [ "$NOW" -ge "$DEADLINE" ] && break

  PENDING=""
  APPS_RUNNING=0
  # сначала — есть ли уже web/gateway (от них зависит, ожидаемо ли падение nginx)
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    svc=$(printf '%s' "$line" | sed -n 's/.*"Service":"\([^"]*\)".*/\1/p')
    st=$(printf '%s' "$line" | sed -n 's/.*"State":"\([^"]*\)".*/\1/p')
    if { [ "$svc" = "web" ] || [ "$svc" = "gateway" ]; } && [ "$st" = "running" ]; then
      APPS_RUNNING=1
    fi
  done < <(ps_lines)

  ALL_READY=1
  for svc in $EXPECTED; do
    line=$(ps_lines | grep "\"Service\":\"$svc\"" | head -n1 || true)
    if [ -z "$line" ]; then
      PENDING="$PENDING $svc(создание…)"
      ALL_READY=0
      continue
    fi
    status=$(printf '%s' "$line" | sed -n 's/.*"Status":"\([^"]*\)".*/\1/p')
    state=$(printf '%s' "$line" | sed -n 's/.*"State":"\([^"]*\)".*/\1/p')
    if is_ready "$status" "$state"; then
      continue
    fi
    if [ "$svc" = "nginx" ] && [ "$APPS_RUNNING" = 0 ]; then
      continue # ожидаемо: нет web/gateway (задача 0.7)
    fi
    PENDING="$PENDING $svc($status)"
    ALL_READY=0
  done

  [ "$ALL_READY" = 1 ] && break
  if [ $((NOW - LAST_SHOUT)) -ge 15 ]; then
    echo "[up]   ждём ($((NOW - STARTED)) с):$(echo "$PENDING" | tr ' ' '\n' | sed 's/^/ /' | tr '\n' ' ')"
    LAST_SHOUT="$NOW"
  fi
  sleep 5
done

echo
echo "[up] стек поднят за $(( $(date +%s) - STARTED )) с"
printf '%-16s %-55s %s\n' "SERVICE" "STATUS" "PORTS"
printf '%-16s %-55s %s\n' "-------" "------" "-----"
for svc in $EXPECTED; do
  line=$(ps_lines | grep "\"Service\":\"$svc\"" | head -n1 || true)
  if [ -z "$line" ]; then
    printf '%-16s %-55s %s\n' "$svc" "не запущен" "-"
    continue
  fi
  status=$(printf '%s' "$line" | sed -n 's/.*"Status":"\([^"]*\)".*/\1/p')
  ports=$(printf '%s' "$line" | sed -n 's/.*"Ports":"\([^"]*\)".*/\1/p')
  if [ "$svc" = "nginx" ] && ! printf '%s' "$status" | grep -q "(healthy)" && [ "$APPS_RUNNING" = 0 ]; then
    status="$status — ожидаемо: нет web/gateway (задача 0.7)"
  fi
  printf '%-16s %-55s %s\n' "$svc" "$status" "${ports:--}"
done

if [ -n "$PENDING" ]; then
  echo "[up] ТАЙМАУТ: не стали здоровыми:" >&2
  for s in $PENDING; do echo "  - $s" >&2; done
  exit 1
fi
echo "[up] все сервисы готовы."
