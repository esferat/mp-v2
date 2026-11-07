#!/usr/bin/env bash
# ============================================================================
# mp-v2 — инициализация PostgreSQL (задача 0.8).
#
# Запускается ОДИН раз при первом старте postgres
# (docker-entrypoint-initdb.d). Идемпотентно: повторный запуск — no-op.
#
# Что делает:
#   * пользователи сервисов: svc_identity, svc_catalog, svc_patients,
#     svc_files, svc_schedule, svc_report (пароли из env SVC_*_PASSWORD);
#   * базы: db_identity, db_catalog, db_patients, db_files, db_schedule,
#     db_report с OWNER соответствующего пользователя;
#   * права: владелец — единственный, кто имеет доступ к базе
#     (REVOKE ... FROM PUBLIC + GRANT). AC 0.8 «report не читает
#     db_schedule» выполняется автоматически.
#
# Весь код — в подшелле, чтобы опции (set -euo) не «утекли» в
# postgres docker-entrypoint.sh, когда скрипт sourced, а не исполняемый.
# ============================================================================
(
set -euo pipefail

psql_t() { # одиночный результат (без заголовков)
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -tAc "$1"
}
psql_c() { # выполнить SQL в базе postgres
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "$1"
}
psql_c_db() { # $1 = база, $2 = SQL
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$1" -c "$2"
}

create_service_user() {
  local name="$1" password="$2"
  if [ -z "${password:-}" ]; then
    echo "init: FATAL — пустой пароль для ${name} (SVC_*_PASSWORD не задан)" >&2
    return 1
  fi
  if [ "$(psql_t "SELECT 1 FROM pg_roles WHERE rolname = '${name}'")" = "1" ]; then
    psql_c "ALTER ROLE \"${name}\" WITH LOGIN PASSWORD '${password}'"
    echo "init: роль ${name} уже есть — пароль обновлён из env"
  else
    psql_c "CREATE ROLE \"${name}\" WITH LOGIN PASSWORD '${password}'"
    echo "init: роль ${name} создана"
  fi
}

create_service_db() {
  local db="$1" owner="$2"
  if [ "$(psql_t "SELECT 1 FROM pg_database WHERE datname = '${db}'")" = "1" ]; then
    psql_c "ALTER DATABASE \"${db}\" OWNER TO \"${owner}\""
    echo "init: база ${db} уже есть — владелец ${owner} подтверждён"
  else
    psql_c "CREATE DATABASE \"${db}\" OWNER \"${owner}\""
    echo "init: база ${db} создана (владелец ${owner})"
  fi
  # Доступ: только владелец. PUBLIC ничего не может (включая CONNECT) —
  # именно это даёт AC 0.8 (пользователь чужой БД получает
  # "permission denied for database").
  psql_c_db "$db" "REVOKE ALL ON DATABASE \"${db}\" FROM PUBLIC; GRANT ALL PRIVILEGES ON DATABASE \"${db}\" TO \"${owner}\";"
  # Схема public: владелец базы — владелец схемы (PG15+), плюм явный GRANT
  psql_c_db "$db" "GRANT ALL PRIVILEGES ON SCHEMA public TO \"${owner}\";"
}

echo "=== mp-v2: создание пользователей и баз сервисов ==="

# Пользователи (пароли — из окружения контейнера, см. docker-compose.yml)
create_service_user "svc_identity"  "${SVC_IDENTITY_PASSWORD:-}"
create_service_user "svc_catalog"   "${SVC_CATALOG_PASSWORD:-}"
create_service_user "svc_patients"  "${SVC_PATIENTS_PASSWORD:-}"
create_service_user "svc_files"     "${SVC_FILES_PASSWORD:-}"
create_service_user "svc_schedule"  "${SVC_SCHEDULE_PASSWORD:-}"
create_service_user "svc_report"    "${SVC_REPORT_PASSWORD:-}"

# Базы: одна на сервис, права — только у владельца
create_service_db "db_identity"  "svc_identity"
create_service_db "db_catalog"   "svc_catalog"
create_service_db "db_patients"  "svc_patients"
create_service_db "db_files"     "svc_files"
create_service_db "db_schedule"  "svc_schedule"
create_service_db "db_report"    "svc_report"

echo "=== mp-v2: инициализация БД завершена ==="
echo "--- базы:"
psql_t "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname"
echo "--- пользователи сервисов:"
psql_t "SELECT rolname FROM pg_roles WHERE rolname LIKE 'svc_%' ORDER BY rolname"
)
