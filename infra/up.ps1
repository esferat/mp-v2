#Requires -Version 5.1
<#
.SYNOPSIS
  mp-v2 infra — поднятие compose-стека и ожидание healthcheck'ов (задача 0.3).

.DESCRIPTION
  1) валидация конфига:  docker compose config -q
  2) поднятие:           docker compose up -d
  3) ожидание health ВСЕХ сервисов (таймаут по умолчанию 10 минут)
  4) итоговая таблица: сервис / статус / порт(ы)

  Пути резолвятся относительно самого скрипта — работает и из корня
  репозитория (./infra/up.ps1), и из infra/ (./up.ps1).
  Если .env нет — используется .env.example (dev-креды).

.PARAMETER NoNginx
  Не поднимать nginx: он не стартует без web/gateway (задача 0.7).
  По умолчанию nginx поднимается; его падение без web/gateway считается
  ОЖИДАЕМЫМ и не валит скрипт.

.PARAMETER TimeoutSec
  Общий таймаут ожидания health, секунд (по умолчанию 600 = 10 минут).
#>
[CmdletBinding()]
param(
    [switch]$NoNginx,
    [int]$TimeoutSec = 600
)

$ErrorActionPreference = 'Stop'

# --- Пути: репозиторий = родитель каталога скрипта -------------------------
$infraDir    = $PSScriptRoot
$repoRoot    = Split-Path -Parent $infraDir
$composeFile = Join-Path $infraDir 'docker-compose.yml'
$envFile     = Join-Path $repoRoot '.env'
if (-not (Test-Path $envFile)) {
    $envFile = Join-Path $repoRoot '.env.example'
    Write-Host "[up] .env не найден — использую .env.example (dev-креды)" -ForegroundColor Yellow
}
if (-not (Test-Path $composeFile)) { throw "не найден $composeFile" }

# --- TLS: на свежем клоне сертификатов *.mp-kit.local нет (в .gitignore) ----
$tlsFull = Join-Path $infraDir 'nginx\tls\fullchain.pem'
if (-not (Test-Path $tlsFull)) {
    Write-Host '[up] TLS-сертификатов нет — генерирую dev CA (*.mp-kit.local)…' -ForegroundColor Yellow
    & (Join-Path $infraDir 'nginx\tls\generate.ps1')
    Write-Host '[up] браузеру ещё нужно доверие CA: nginx\tls\generate.ps1 -InstallTrust (см. nginx\tls\README.md)' -ForegroundColor Yellow
}

function Invoke-DockerCompose {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest)
    & docker compose --env-file $envFile -f $composeFile @Rest
    return $LASTEXITCODE
}

# Разбор вывода `compose ps --format json`: поддерживаем и JSON-массив,
# и построчный JSON (поведение менялось между версиями compose).
function ConvertFrom-ComposeJsonLines {
    param([string]$Raw)
    $items = @()
    if ([string]::IsNullOrWhiteSpace($Raw)) { return $items }
    $Raw = $Raw.Trim()
    if ($Raw.StartsWith('[')) {
        $items = @(ConvertFrom-Json -InputObject $Raw)
    } else {
        foreach ($line in ($Raw -split "`r?`n")) {
            $t = $line.Trim()
            if ($t.Length -gt 0) { $items += ConvertFrom-Json -InputObject $t }
        }
    }
    return $items
}

Write-Host '[up] 1/3 — валидация compose-конфига (config -q)…' -ForegroundColor Cyan
$code = Invoke-DockerCompose config -q
if ($code -ne 0) { throw 'compose config: ошибки интерполяции/схемы — см. выше' }

# Ожидаемые сервисы: config без активных профилей отдаёт только те,
# что реально поднимутся.
$cfgRaw = (& docker compose --env-file $envFile -f $composeFile config --format json | Out-String)
$cfg    = ConvertFrom-Json -InputObject $cfgRaw
$expected = @($cfg.services.PSObject.Properties.Name)
if ($NoNginx) { $expected = @($expected | Where-Object { $_ -ne 'nginx' }) }

Write-Host ("[up] 2/3 — docker compose up -d ({0} сервис(ов))…" -f $expected.Count) -ForegroundColor Cyan
if ($NoNginx) {
    $code = Invoke-DockerCompose up -d @expected
} else {
    $code = Invoke-DockerCompose up -d
}
if ($code -ne 0) { throw 'docker compose up -d завершился ошибкой' }

# --- Ожидание health --------------------------------------------------------
Write-Host "[up] 3/3 — ожидание health (таймаут $TimeoutSec с)…" -ForegroundColor Cyan
$startedAt  = Get-Date
$deadline   = $startedAt.AddSeconds($TimeoutSec)
$lastShout  = [DateTime]::MinValue
$readyMap   = @{}
$pendingNow = @()
$lastPs     = @()

while ($true) {
    $psRaw  = (& docker compose --env-file $envFile -f $composeFile ps -a --format json | Out-String)
    $lastPs = ConvertFrom-ComposeJsonLines -Raw $psRaw
    $byService = @{}
    foreach ($c in $lastPs) { $byService[[string]$c.Service] = $c }

    # web/gateway ещё не существуют (0.7) → падение nginx ожидаемо
    $appsRunning = $false
    foreach ($app in @('web', 'gateway')) {
        if ($byService.ContainsKey($app) -and [string]$byService[$app].State -eq 'running') { $appsRunning = $true }
    }

    $readyMap   = @{}
    $pendingNow = @()
    foreach ($svc in $expected) {
        if (-not $byService.ContainsKey($svc)) {
            $pendingNow += "$svc (создание…)"
            continue
        }
        $c      = $byService[$svc]
        $status = [string]$c.Status
        $state  = [string]$c.State
        $healthy = $status -match '\(healthy\)'
        $exitOk  = ($state -eq 'exited' -and $status -match 'Exited \(0\)')
        if ($healthy) { $readyMap[$svc] = $status; continue }
        if ($exitOk)  { $readyMap[$svc] = $status; continue }   # init-джобы (minio-init, elastic-init)
        if ($svc -eq 'nginx' -and -not $appsRunning) {
            $readyMap[$svc] = "$status — ожидаемо: нет web/gateway (задача 0.7)"
            continue
        }
        $pendingNow += "$svc ($status)"
    }

    if ($pendingNow.Count -eq 0) { break }
    if ((Get-Date) -ge $deadline) { break }

    if (((Get-Date) - $lastShout).TotalSeconds -ge 15) {
        $elapsed = [int]((Get-Date) - $startedAt).TotalSeconds
        Write-Host ("[up]   ждём ({0} с): {1}" -f $elapsed, ($pendingNow -join '; '))
        $lastShout = Get-Date
    }
    Start-Sleep -Seconds 5
}

# --- Итоговая таблица -------------------------------------------------------
$elapsed = [int]((Get-Date) - $startedAt).TotalSeconds
$rows = @()
foreach ($svc in ($expected | Sort-Object)) {
    $status = 'не запущен'
    $ports  = ''
    if ($readyMap.ContainsKey($svc))     { $status = $readyMap[$svc] }
    elseif ($lastPs | Where-Object { [string]$_.Service -eq $svc } | Select-Object -First 1) {
        $c = $lastPs | Where-Object { [string]$_.Service -eq $svc } | Select-Object -First 1
        $status = [string]$c.Status
        $ports  = [string]$c.Ports
    }
    if ($readyMap.ContainsKey($svc)) {
        $c = $lastPs | Where-Object { [string]$_.Service -eq $svc } | Select-Object -First 1
        if ($c) { $ports = [string]$c.Ports }
    }
    $rows += [PSCustomObject]@{ Service = $svc; Status = $status; Ports = $ports }
}
Write-Host ''
Write-Host ("[up] стек поднят за {0} с" -f $elapsed) -ForegroundColor Green
$rows | Format-Table -AutoSize | Out-Host

if ($pendingNow.Count -gt 0) {
    Write-Host "[up] ТАЙМАУТ: не стали здоровыми:" -ForegroundColor Red
    $pendingNow | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}
Write-Host '[up] все сервисы готовы.' -ForegroundColor Green
exit 0
