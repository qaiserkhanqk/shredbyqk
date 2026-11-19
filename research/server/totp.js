// Time-based one-time passwords (RFC 6238, HMAC-SHA-1, 30-second steps, 6 digits), the scheme used by common
// authenticator apps. node:crypto only. Secrets are base32 (RFC 4648) without padding.
import { createHmac, timingSafeEqual } from 'node:crypto';

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const fail = code => Object.assign(new Error(code), { code });

export function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const b of buf) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += ALPHA[(value >>> (bits - 5)) & 31]; bits -= 5; }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHA[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s) {
  const clean = String(s).toUpperCase().replace(/\s+/g, '').replace(/=+$/, '');
  let bits = 0, value = 0; const out = [];
  for (const c of clean) {
    const i = ALPHA.indexOf(c); if (i < 0) throw fail('base32_invalid');
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
    value &= (1 << bits) - 1;
  }
  return Buffer.from(out);
}

export const STEP_SECONDS = 30;
export const stepAt = (timeMs, step = STEP_SECONDS) => Math.floor(timeMs / 1000 / step);

function hotp(key, counter, digits) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', key).update(msg).digest(), o = h[h.length - 1] & 15;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 10 ** digits).padStart(digits, '0');
}

/** The code for `timeMs` (milliseconds since the epoch). */
export function totp(secret, timeMs, { digits = 6, step = STEP_SECONDS } = {}) { return hotp(base32Decode(secret), stepAt(timeMs, step), digits); }

/**
 * Checks `code` against the steps around `timeMs` (±window). Only a step LATER than `lastStep` is accepted, so a code
 * can never be used twice. Returns the matching step, or null.
 */
export function verifyTotp(secret, code, timeMs, { window = 1, lastStep = -1, digits = 6, step = STEP_SECONDS } = {}) {
  const c = String(code ?? '');
  if (!new RegExp(`^\\d{${digits}}$`).test(c)) return null;
  const key = base32Decode(secret), now = stepAt(timeMs, step);
  let match = null;
  for (let s = now - window; s <= now + window; s++) { // compare every candidate (no early exit)
    if (s <= lastStep) continue;
    if (timingSafeEqual(Buffer.from(hotp(key, s, digits)), Buffer.from(c)) && match === null) match = s;
  }
  return match;
}
