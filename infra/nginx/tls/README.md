# TLS для `*.mp-kit.local` (nginx, терминал на нём же)

Самоподписанный **dev CA** + wildcard-сертификат `*.mp-kit.local` — HTTPS для
всех доменов стека (portal, auth, kibana, minio, mailpit, rabbitmq).

## Состав

| Файл                                           | Назначение                                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| `ca.cnf`, `leaf.cnf`, `generate.ps1`           | генерация (в репозитории)                                                              |
| `ca.key.pem`, `ca.crt.pem`, `ca.cer`           | dev CA (ключи — только локально, в `.gitignore`)                                       |
| `mp-kit.local.key.pem`, `mp-kit.local.crt.pem` | серверный сертификат (SAN: `*.mp-kit.local`, `mp-kit.local`, `localhost`, `127.0.0.1`) |
| `fullchain.pem`                                | leaf + CA — `ssl_certificate` в nginx                                                  |

## Перегенерация

```powershell
./infra/nginx/tls/generate.ps1 -InstallTrust   # + доверие CA для браузера
docker compose --env-file .env.example -f infra/docker-compose.yml restart nginx
```

`-InstallTrust` кладёт CA в `Cert:\CurrentUser\Root` (без админ-прав) —
Chrome/Edge перестают ругаться на `https://*.mp-kit.local`. Повторный запуск
**пересоздаёт ключи**: после него доверие ставить заново.

## Требования к хосту

В `C:\Windows\System32\drivers\etc\hosts` (права администратора):

```
127.0.0.1 mp-kit.local
127.0.0.1 portal.mp-kit.local
127.0.0.1 auth.mp-kit.local
127.0.0.1 kibana.mp-kit.local
127.0.0.1 minio.mp-kit.local
127.0.0.1 mailpit.mp-kit.local
127.0.0.1 rabbitmq.mp-kit.local
```

> Только для локальной разработки: приватный ключ CA лежит в репозитории и
> подписывает всё `*.mp-kit.local` — в проде такие сертификаты не используются.
