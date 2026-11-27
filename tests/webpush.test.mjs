// Web Push: the message a phone receives decrypts to what we sent, and the VAPID token verifies.
import crypto from 'node:crypto';
import { encrypt, vapidHeader, vapidKeys, b64u, unb64u } from '../tools/webpush.mjs';
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : '  ' + detail}`); if (!ok) fails++; };
const hkdf = (salt, ikm, info, len) => Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, len));

// A pretend phone: its key pair and auth secret, as the browser makes them.
const phone = crypto.createECDH('prime256v1'); phone.generateKeys();
const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: b64u(phone.getPublicKey()), auth: b64u(crypto.randomBytes(16)) } };
const msg = { title: 'Check-in day with QK', body: 'Weigh yourself before breakfast.', url: './?tab=food' };
const body = encrypt(msg, sub);

// Decrypt as the phone does (RFC 8291).
const salt = body.subarray(0, 16), rs = body.readUInt32BE(16), idlen = body[20], asPub = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
const shared = phone.computeSecret(asPub);
const ikm = hkdf(unb64u(sub.keys.auth), shared, Buffer.concat([Buffer.from('WebPush: info\0'), phone.getPublicKey(), asPub]), 32);
const d = crypto.createDecipheriv('aes-128-gcm', hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16), hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12));
d.setAuthTag(ct.subarray(ct.length - 16));
const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
check('header: 4096-byte records, 65-byte server key', rs === 4096 && idlen === 65);
check('ends with the last-record delimiter', plain[plain.length - 1] === 2);
check('phone decrypts exactly what was sent', JSON.stringify(JSON.parse(plain.subarray(0, -1))) === JSON.stringify(msg));
check('a different phone can\'t read it', (() => { try { const o = crypto.createECDH('prime256v1'); o.generateKeys(); const s2 = o.computeSecret(asPub); const k2 = hkdf(unb64u(sub.keys.auth), s2, Buffer.concat([Buffer.from('WebPush: info\0'), o.getPublicKey(), asPub]), 32); const d2 = crypto.createDecipheriv('aes-128-gcm', hkdf(salt, k2, Buffer.from('Content-Encoding: aes128gcm\0'), 16), hkdf(salt, k2, Buffer.from('Content-Encoding: nonce\0'), 12)); d2.setAuthTag(ct.subarray(ct.length - 16)); d2.update(ct.subarray(0, ct.length - 16)); d2.final(); return false; } catch { return true; } })());

// VAPID: the push service checks this token against the public key.
const keys = { ...vapidKeys(), subject: 'mailto:coach@example.com' };
const h = vapidHeader(sub.endpoint, keys);
const [, jwt, k] = h.match(/^vapid t=([^,]+), k=(.+)$/);
const [hd, bd, sg] = jwt.split('.');
const pub = unb64u(keys.publicKey);
const pk = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33)) }, format: 'jwk' });
check('VAPID token is signed by our key', crypto.verify('sha256', Buffer.from(`${hd}.${bd}`), { key: pk, dsaEncoding: 'ieee-p1363' }, unb64u(sg)));
const claims = JSON.parse(unb64u(bd));
check('token is for that push service, expires within 24 h', claims.aud === 'https://fcm.googleapis.com' && claims.exp - Date.now() / 1000 <= 24 * 3600 && k === keys.publicKey);

console.log(fails ? `\n${fails} failed` : '\nall web push checks pass');
process.exit(fails ? 1 : 0);
