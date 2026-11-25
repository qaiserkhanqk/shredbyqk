// HTTPS for the local research dashboard. Safari does not keep Secure cookies on plain http, so HTTPS is how Safari
// users sign in without weakening the Secure cookie default (docs/browser-test-report-2026-11-25.md, finding 3).
// makeLocalCert() creates a self-signed certificate for localhost, 127.0.0.1 and ::1 with the system's openssl. Browsers
// show a one-time warning for it; for no warning, use a locally trusted certificate (e.g. mkcert) instead, see
// research/docs/security-operations.md. Private keys are written owner-only (0600) and refused if others can read them,
// the same rule as the database key file (keys.js).
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, statSync, chmodSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const fail = code => { throw Object.assign(new Error(code), { code }); };

/** Creates cert.pem and key.pem in `dir` (refuses to overwrite). Returns their paths. Needs openssl on PATH. */
export function makeLocalCert(dir, { days = 90 } = {}) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const certPath = join(dir, 'cert.pem'), keyPath = join(dir, 'key.pem');
  if (existsSync(certPath) || existsSync(keyPath)) fail('tls_exists');
  const r = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', String(days),
    '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1',
    '-keyout', keyPath, '-out', certPath], { encoding: 'utf8' });
  if (r.error?.code === 'ENOENT') fail('openssl_unavailable');
  if (r.status !== 0) fail('tls_generation_failed');
  chmodSync(keyPath, 0o600); chmodSync(certPath, 0o644);
  return { certPath, keyPath };
}

/** The certificate's subject alternative names, for checks and the operator's terminal. */
export function certInfo(certPath) {
  const r = spawnSync('openssl', ['x509', '-in', certPath, '-noout', '-ext', 'subjectAltName'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : '';
}

/** Loads a certificate and key for the server. Both are required; the key must not be readable by others. */
export function loadTls(certPath, keyPath) {
  if (!certPath || !keyPath) fail('tls_incomplete');
  if (statSync(keyPath).mode & 0o077) fail('tls_key_permissions');
  return { cert: readFileSync(certPath), key: readFileSync(keyPath), certPath };
}
