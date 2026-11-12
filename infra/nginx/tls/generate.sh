#!/usr/bin/env bash
# ============================================================================
# Generates a self-signed dev CA and a wildcard certificate for
# *.mp-kit.local (nginx TLS - see README.md in this directory).
#
# Windows/PowerShell equivalent: ./generate.ps1 (openssl from PATH or
# Git for Windows). Outputs are local-only (gitignored).
#
# Usage:
#   ./generate.sh                 # regenerate CA + server certificate
#   DAYS_CA=1825 DAYS_LEAF=398 ./generate.sh
#
# After regeneration the CA must be trusted again (see README.md):
#   Windows: powershell -File generate.ps1 -InstallTrust
#   Linux:   sudo cp ca.crt.pem /usr/local/share/ca-certificates/mp-kit.crt \
#            && sudo update-ca-certificates
# Then: docker compose ... restart nginx
# ============================================================================
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DAYS_CA="${DAYS_CA:-3650}"
DAYS_LEAF="${DAYS_LEAF:-825}"

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl not found" >&2
  exit 1
fi

cd "$DIR"

# 1) Dev CA
openssl req -x509 -newkey rsa:2048 -nodes -keyout ca.key.pem -out ca.crt.pem \
    -days "$DAYS_CA" -config ca.cnf
# 2) Server cert signed by the CA
openssl req -newkey rsa:2048 -nodes -keyout mp-kit.local.key.pem -out leaf.csr \
    -config leaf.cnf
openssl x509 -req -in leaf.csr -CA ca.crt.pem -CAkey ca.key.pem -CAcreateserial \
    -out mp-kit.local.crt.pem -days "$DAYS_LEAF" -extfile leaf.cnf -extensions v3_cert
rm -f leaf.csr
# 3) Chain for nginx (leaf + CA)
cat mp-kit.local.crt.pem ca.crt.pem > fullchain.pem
# 4) DER copy of the CA (Windows trust store does not read PEM)
openssl x509 -in ca.crt.pem -outform DER -out ca.cer

echo "OK: CA + *.mp-kit.local (leaf $DAYS_LEAF days) in $DIR"
