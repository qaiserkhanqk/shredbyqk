#!/usr/bin/env bash
# Makes a local certificate authority (CA) and a server certificate for testing the app on a real iPhone over HTTPS
# on the local network. The app needs a secure context (Web Crypto), and iOS only treats a site as secure when its
# certificate chains to a CA the phone fully trusts.
#
#   bash tests/ios/make-certs.sh <this-Mac's-local-IP>
#
# Output goes to tests/ios/.certs/ (git-ignored, folder 700, every file 600):
#   ca.key      CA private key       — never leaves this Mac
#   ca.pem      CA certificate       — the ONLY file to put on the iPhone (AirDrop), then enable full trust
#   server.key  server private key   — never leaves this Mac
#   server.crt  server certificate   — for the IP above, localhost and 127.0.0.1; serverAuth only
# Validity is 800 days (iOS refuses TLS server certificates valid for more than 825 days).
# The CA is reused if it already exists, so re-running for a new IP does not require reinstalling it on the phone.
# When testing is finished: delete the profile on the iPhone (Settings → General → VPN & Device Management) and
# delete tests/ios/.certs/.
set -euo pipefail
IP="${1:?usage: bash tests/ios/make-certs.sh <this-Mac-local-IP>}"
[[ "$IP" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || { echo "not an IPv4 address: $IP" >&2; exit 1; }
DIR="$(cd "$(dirname "$0")" && pwd)/.certs"
umask 077
mkdir -p "$DIR"; chmod 700 "$DIR"; cd "$DIR"
DAYS=800

if [ ! -f ca.key ] || [ ! -f ca.pem ]; then
  cat > ca.cnf <<'EOF'
[req]
distinguished_name = dn
prompt = no
x509_extensions = v3_ca
[dn]
CN = Shred by QK local test CA (this Mac only)
O = Shred by QK testing
[v3_ca]
basicConstraints = critical, CA:TRUE, pathlen:0
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash
EOF
  openssl genrsa -out ca.key 3072 2>/dev/null
  openssl req -x509 -new -key ca.key -sha256 -days "$DAYS" -config ca.cnf -out ca.pem
fi

cat > server-req.cnf <<EOF
[req]
distinguished_name = dn
prompt = no
[dn]
CN = $IP
O = Shred by QK testing
EOF
cat > server-ext.cnf <<EOF
[v3]
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = IP:$IP, DNS:localhost, IP:127.0.0.1
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid
EOF
openssl genrsa -out server.key 2048 2>/dev/null
openssl req -new -key server.key -config server-req.cnf -out server.csr
openssl x509 -req -in server.csr -CA ca.pem -CAkey ca.key -CAcreateserial -days "$DAYS" -sha256 \
  -extfile server-ext.cnf -extensions v3 -out server.crt 2>/dev/null
rm -f server.csr
chmod 600 ./*
openssl verify -CAfile ca.pem server.crt >/dev/null
echo "certificates ready in $DIR (valid $DAYS days, for $IP, localhost, 127.0.0.1)"
