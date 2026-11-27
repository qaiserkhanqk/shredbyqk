// Web Push without a library (Node 18+): VAPID sign-in (RFC 8292) and message encryption (RFC 8291,
// aes128gcm). Used by tools/push-checkins.mjs to reach phones while the app is closed.
//
//   node tools/webpush.mjs keys     → prints a new VAPID key pair (public goes in js/cloud-config.js,
//                                     private stays secret: a GitHub Actions secret, never in the app)
import crypto from 'node:crypto';

export const b64u = buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64u = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/** A new VAPID key pair: { publicKey (65-byte uncompressed point), privateKey (32-byte scalar) }, base64url. */
export function vapidKeys() {
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  return { publicKey: b64u(ecdh.getPublicKey()), privateKey: b64u(ecdh.getPrivateKey()) };
}
const privateKeyObject = (publicKey, privateKey) => {
  const pub = unb64u(publicKey);
  return crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: b64u(unb64u(privateKey)), x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }, format: 'jwk' });
};

/** The Authorization header value for one push service: "vapid t=<JWT>, k=<public key>". */
export function vapidHeader(endpoint, { publicKey, privateKey, subject }, now = Date.now()) {
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject }));
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key: privateKeyObject(publicKey, privateKey), dsaEncoding: 'ieee-p1363' });
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${publicKey}`;
}

const hkdf = (salt, ikm, info, len) => Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, len));

/** Encrypt a payload for one subscription ({ keys: { p256dh, auth } }). Returns the request body. */
export function encrypt(payload, sub, { salt = crypto.randomBytes(16), ecdh = null } = {}) {
  const ua = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const as = ecdh || crypto.createECDH('prime256v1'); if (!ecdh) as.generateKeys();
  const asPub = as.getPublicKey(), shared = as.computeSecret(ua);
  const ikm = hkdf(auth, shared, Buffer.concat([Buffer.from('WebPush: info\0'), ua, asPub]), 32);
  const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const text = Buffer.concat([c.update(Buffer.concat([Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload)), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const head = Buffer.alloc(21); salt.copy(head, 0); head.writeUInt32BE(4096, 16); head.writeUInt8(asPub.length, 20);
  return Buffer.concat([head, asPub, text]);
}

/** Send one push. Returns the HTTP status (201 sent; 404/410 = the phone unsubscribed, delete it). */
export async function send(sub, payload, vapid, { ttl = 24 * 3600, urgency = 'normal', fetch: f = globalThis.fetch } = {}) {
  const res = await f(sub.endpoint, {
    method: 'POST',
    headers: { Authorization: vapidHeader(sub.endpoint, vapid), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: String(ttl), Urgency: urgency },
    body: encrypt(payload, sub),
  });
  return res.status;
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv[2] === 'keys') {
  const k = vapidKeys();
  console.log(`VAPID_PUBLIC_KEY=${k.publicKey}\nVAPID_PRIVATE_KEY=${k.privateKey}`);
}
