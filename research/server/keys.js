// Key handling for encryption at rest. node:crypto only.
// • Key files hold one 32-byte key as base64 and must be readable by their owner only (mode 0600).
// • Envelope encryption: a random DATA key encrypts the database fields; the operator's KEY-ENCRYPTION key (the key
//   file) only wraps the data key. Rotating the key file therefore re-wraps one value, not the whole database.
// • Field values are AES-256-GCM with a fresh 96-bit IV and associated data naming the table, column and participant,
//   so a ciphertext copied to another row or participant fails to decrypt.
// • Values that must stay comparable (unique keys, purge-by-type) are replaced by keyed HMAC-SHA-256 "blind indexes",
//   which cannot be reversed or brute-forced without the key.
import { randomBytes, createCipheriv, createDecipheriv, createHmac, hkdfSync } from 'node:crypto';
import { readFileSync, writeFileSync, statSync, chmodSync } from 'node:fs';

const fail = code => Object.assign(new Error(code), { code });
export const ENC_SCHEME = 'field-aes-256-gcm-v1';
export const generateKey = () => randomBytes(32);
export function assertKey(k) { if (!Buffer.isBuffer(k) || k.length !== 32) throw fail('key_invalid'); return k; }

/** Writes a new key file (owner-only). Refuses to overwrite an existing file. */
export function writeKeyFile(path, key) {
  assertKey(key);
  writeFileSync(path, key.toString('base64') + '\n', { mode: 0o600, flag: 'wx' });
  chmodSync(path, 0o600); // in case the umask changed the mode
}

/** Loads a key file. Refuses files that group or others can read or write, and anything that is not 32 bytes. */
export function loadKeyFile(path) {
  const st = statSync(path);
  if (process.platform !== 'win32' && (st.mode & 0o077)) throw fail('key_file_permissions');
  const t = readFileSync(path, 'utf8').trim();
  if (!/^[A-Za-z0-9+/]{43}=$/.test(t)) throw fail('key_invalid');
  return assertKey(Buffer.from(t, 'base64'));
}

const seal = (key, plain, aad) => {
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key, iv); c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([iv, ct, c.getAuthTag()]);
};
const open = (key, buf, aad) => {
  if (buf.length < 28) throw fail('decrypt_failed');
  const d = createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12)); d.setAAD(Buffer.from(aad)); d.setAuthTag(buf.subarray(buf.length - 16));
  try { return Buffer.concat([d.update(buf.subarray(12, buf.length - 16)), d.final()]); } catch { throw fail('decrypt_failed'); }
};

/** Wraps the data key with the key-encryption key. */
export const wrapKey = (kek, dek) => seal(assertKey(kek), assertKey(dek), 'rs-dek-v1').toString('base64');
/** Unwraps the data key; the wrong key-encryption key gives `db_key_invalid`. */
export function unwrapKey(kek, wrapped) {
  assertKey(kek);
  let dek; try { dek = open(kek, Buffer.from(String(wrapped), 'base64'), 'rs-dek-v1'); } catch { throw fail('db_key_invalid'); }
  return assertKey(dek);
}

/** Field encryption and blind indexes derived from a data key. */
export function fieldCipher(dek) {
  const fk = Buffer.from(hkdfSync('sha256', assertKey(dek), Buffer.alloc(0), 'rs-fields-v1', 32));
  const ik = Buffer.from(hkdfSync('sha256', dek, Buffer.alloc(0), 'rs-index-v1', 32));
  return {
    enc: (plain, aad) => 'e1.' + seal(fk, Buffer.from(String(plain), 'utf8'), aad).toString('base64url'),
    dec(v, aad) {
      if (typeof v !== 'string' || !v.startsWith('e1.')) throw fail('field_not_encrypted');
      return open(fk, Buffer.from(v.slice(3), 'base64url'), aad).toString('utf8');
    },
    idx: v => 'k1.' + createHmac('sha256', ik).update(String(v)).digest('hex'),
  };
}
export const isEncryptedField = v => typeof v === 'string' && v.startsWith('e1.');
