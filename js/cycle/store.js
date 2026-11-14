// Encrypted, per-user repository for cycle data.
//
//  • Separate from the main app store (shred_qk_v1), so cycle data never appears in session exports,
//    window.__shred, coach-voice text or the error log.
//  • Encrypted at rest with AES-GCM-256 (WebCrypto). In the browser the key is a NON-EXTRACTABLE CryptoKey
//    kept in IndexedDB, so scripts can use it but cannot read it out.
//  • Per-user isolation: each user has their own storage slot and key, the user ID is bound into the
//    ciphertext as additional authenticated data (AAD), and a decrypted record must name the reader as its
//    owner. Copying one user's blob into another user's slot fails to decrypt.
//  • If WebCrypto is unavailable the repository refuses to store anything (no plaintext fallback).
//  • Delete removes the ciphertext AND destroys the key ("crypto-shredding").
// Limits (documented in CYCLE.md): this protects data at rest on the device against casual access, other
// sites and copied storage. It does not protect against malware or someone using the unlocked phone, and
// it is not a substitute for server-side access control once a backend exists.
import { blankState, CycleError, SCHEMA } from './model.js';

const PREFIX = 'shred_cycle_v1:';
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = u8 => (typeof Buffer !== 'undefined' ? Buffer.from(u8).toString('base64') : btoa(String.fromCharCode(...u8)));
const unb64 = s => (typeof Buffer !== 'undefined' ? new Uint8Array(Buffer.from(s, 'base64')) : Uint8Array.from(atob(s), c => c.charCodeAt(0)));
const aad = userId => enc.encode(`shred-cycle|${userId}|v1`);
const subtle = () => { const s = globalThis.crypto?.subtle; if (!s) throw new CycleError('CRYPTO_UNAVAILABLE'); return s; };

/** In-memory key provider (tests and Node). */
export function memoryKeys() {
  const m = new Map();
  return {
    async get(userId) { if (!m.has(userId)) m.set(userId, await subtle().generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])); return m.get(userId); },
    async delete(userId) { m.delete(userId); },
    has: userId => m.has(userId),
  };
}

/** Browser key provider: non-extractable keys in IndexedDB. */
export function indexedDbKeys(dbName = 'shred_cycle_keys') {
  const open = () => new Promise((res, rej) => { const r = indexedDB.open(dbName, 1); r.onupgradeneeded = () => r.result.createObjectStore('keys'); r.onsuccess = () => res(r.result); r.onerror = () => rej(new CycleError('KEYSTORE_UNAVAILABLE')); });
  const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('keys', mode), st = t.objectStore('keys'), req = fn(st); t.oncomplete = () => { db.close(); res(req?.result); }; t.onerror = () => { db.close(); rej(new CycleError('KEYSTORE_UNAVAILABLE')); }; }); };
  return {
    async get(userId) {
      let k = await tx('readonly', st => st.get(userId));
      if (!k) { k = await subtle().generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); await tx('readwrite', st => st.put(k, userId)); }
      return k;
    },
    async delete(userId) { await tx('readwrite', st => st.delete(userId)); },
  };
}

/** Wrap a synchronous localStorage-like object. */
export const syncStorage = ls => ({ get: async k => ls.getItem(k), set: async (k, v) => ls.setItem(k, v), remove: async k => ls.removeItem(k) });
/** In-memory storage (tests). */
export function memoryStorage() { const m = new Map(); return { get: async k => m.get(k) ?? null, set: async (k, v) => { m.set(k, v); }, remove: async k => { m.delete(k); }, raw: m }; }

/** A random local user ID for this device (not health data). A multi-user product needs real accounts. */
export function localUserId(ls = globalThis.localStorage) {
  let id = ls.getItem('shred_cycle_uid');
  if (!id) { id = globalThis.crypto.randomUUID(); ls.setItem('shred_cycle_uid', id); }
  return id;
}

async function encrypt(key, userId, obj) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: aad(userId) }, key, enc.encode(JSON.stringify(obj))));
  return JSON.stringify({ v: 1, alg: 'AES-GCM-256', iv: b64(iv), ct: b64(ct) });
}
async function decrypt(key, userId, text) {
  let blob; try { blob = JSON.parse(text); } catch { throw new CycleError('CORRUPT'); }
  try {
    const pt = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(blob.iv), additionalData: aad(userId) }, key, unb64(blob.ct));
    return JSON.parse(dec.decode(pt));
  } catch { throw new CycleError('DECRYPT_FAILED'); }
}

export async function openCycleRepo({ storage, keys, userId }) {
  if (!userId || typeof userId !== 'string') throw new CycleError('ACCESS_DENIED');
  subtle(); // fail early, before anything is written, if encryption is unavailable
  const slot = PREFIX + userId;
  let key = await keys.get(userId), state;
  const text = await storage.get(slot);
  if (text) {
    state = await decrypt(key, userId, text);
    if (state.owner !== userId) throw new CycleError('ACCESS_DENIED');
  } else state = blankState(userId);

  const repo = {
    userId,
    /** A copy of the state. Mutating it changes nothing. */
    read: () => structuredClone(state),
    /** Apply a change atomically: if fn throws, nothing is saved. */
    async update(fn) {
      const draft = structuredClone(state); const out = fn(draft);
      if (draft.owner !== userId) throw new CycleError('ACCESS_DENIED');
      await storage.set(slot, await encrypt(key, userId, draft)); state = draft; return out;
    },
    /** Everything this user has stored, decrypted, for the user to keep. */
    exportData: () => ({ format: 'shred-cycle-export', schema: SCHEMA, exportedAt: new Date().toISOString(),
      note: 'Your cycle data from Shred by QK. Keep this file private: it is not encrypted.', data: structuredClone(state) }),
    /** Delete everything: ciphertext and key. Returns what was done and what can't be reached. */
    async deleteAll() {
      await storage.remove(slot); await keys.delete(userId); state = blankState(userId); key = await keys.get(userId);
      return { deleted: ['cycle records', 'symptom logs', 'reminders', 'wearable summaries', 'consent record', 'encryption key'],
        notReached: ['files you exported yourself', 'device or browser backups made before deletion (they hold only encrypted data, but may also hold the key)'] };
    },
  };
  return repo;
}
