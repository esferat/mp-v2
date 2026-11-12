<#
.SYNOPSIS
  Generates a self-signed dev CA and a wildcard server certificate for
  *.mp-kit.local (nginx TLS - see infra/nginx/nginx.conf).

.DESCRIPTION
  Outputs (local only, gitignored by infra/nginx/tls/*.pem|*.key|*.cer|*.srl):
    ca.key.pem / ca.crt.pem / ca.cer - dev CA (private key never leaves the machine)
    mp-kit.local.key.pem / mp-kit.local.crt.pem - server cert
    fullchain.pem - leaf + CA, used by nginx ssl_certificate

  Re-running regenerates ALL files (new keys): re-add the CA with -InstallTrust
  and restart nginx afterwards.

.PARAMETER InstallTrust
  Add the CA to Cert:\CurrentUser\Root so Chrome/Edge trust https://*.mp-kit.local.

.EXAMPLE
  ./generate.ps1 -InstallTrust
#>
param(
    [int]$DaysCa = 3650,
    [int]$DaysLeaf = 825,
    [switch]$InstallTrust
)

$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

# openssl: PATH first, then Git for Windows (the project assumes git is present)
$cmd = Get-Command openssl -ErrorAction SilentlyContinue
if ($cmd) {
    $openssl = $cmd.Source
} elseif (Test-Path 'C:\Program Files\Git\usr\bin\openssl.exe') {
    $openssl = 'C:\Program Files\Git\usr\bin\openssl.exe'
} else {
    throw 'openssl not found: install Git for Windows or add openssl to PATH'
}

Push-Location $dir
try {
    # 1) Dev CA
    & $openssl req -x509 -newkey rsa:2048 -nodes -keyout ca.key.pem -out ca.crt.pem `
        -days $DaysCa -config ca.cnf
    if ($LASTEXITCODE -ne 0) { throw 'CA generation failed' }

    # 2) Server cert signed by the CA
    & $openssl req -newkey rsa:2048 -nodes -keyout mp-kit.local.key.pem -out leaf.csr `
        -config leaf.cnf
    if ($LASTEXITCODE -ne 0) { throw 'CSR generation failed' }
    & $openssl x509 -req -in leaf.csr -CA ca.crt.pem -CAkey ca.key.pem -CAcreateserial `
        -out mp-kit.local.crt.pem -days $DaysLeaf -extfile leaf.cnf -extensions v3_cert
    if ($LASTEXITCODE -ne 0) { throw 'certificate signing failed' }
    Remove-Item leaf.csr -Force

    # 3) Chain for nginx (leaf + CA)
    [IO.File]::WriteAllBytes(
        (Join-Path $dir 'fullchain.pem'),
        [byte[]](
            [IO.File]::ReadAllBytes((Join-Path $dir 'mp-kit.local.crt.pem')) +
            [IO.File]::ReadAllBytes((Join-Path $dir 'ca.crt.pem'))
        )
    )

    # 4) DER copy of the CA - Windows trust store does not read PEM
    & $openssl x509 -in ca.crt.pem -outform DER -out ca.cer
    if ($LASTEXITCODE -ne 0) { throw 'CA DER export failed' }

    Write-Host "OK: CA + *.mp-kit.local (leaf $DaysLeaf days) in $dir"

    if ($InstallTrust) {
        # Current user root store: no elevation required, Chrome/Edge read it
        Import-Certificate -FilePath (Join-Path $dir 'ca.cer') `
            -CertStoreLocation Cert:\CurrentUser\Root | Out-Null
        Write-Host 'CA installed into Cert:\CurrentUser\Root (browser trusts it).'
    }
} finally {
    Pop-Location
}
