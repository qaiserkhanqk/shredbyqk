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

/* AAD binds the user ID and, for v2 records, the generation and revision, so a record can't be moved to another
   user, replayed into another generation, or have its revision number edited without failing to decrypt. */
const aadFor = (userId, blob) => (blob.v >= 2 ? enc.encode(`shred-cycle|${userId}|v2|${blob.gen}|${blob.rev}`) : aad(userId));

async function encrypt(key, userId, obj, gen, rev) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12)), meta = { v: 2, gen, rev };
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: aadFor(userId, meta) }, key, enc.encode(JSON.stringify(obj))));
  return JSON.stringify({ ...meta, alg: 'AES-GCM-256', iv: b64(iv), ct: b64(ct) });
}
function parseBlob(text) { try { return JSON.parse(text); } catch { throw new CycleError('CORRUPT'); } }
async function decrypt(key, userId, blob) {
  try {
    const pt = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(blob.iv), additionalData: aadFor(userId, blob) }, key, unb64(blob.ct));
    return JSON.parse(dec.decode(pt));
  } catch { throw new CycleError('DECRYPT_FAILED'); }
}

/* ---------- Serialisation ----------
   localQueue: runs one operation at a time inside this tab (fixes "delete during an outstanding save").
   lock: optional cross-tab mutex. In the browser use webLock() (Web Locks API); in tests use a shared memoryLock().
   Without a cross-tab lock the generation/revision checks still detect conflicts, with a small race window. */
export function memoryLock() {
  let chain = Promise.resolve();
  return { run(fn) { const p = chain.then(() => fn()); chain = p.catch(() => {}); return p; } };
}
export function webLock(name) {
  return globalThis.navigator?.locks ? { run: fn => globalThis.navigator.locks.request(name, () => fn()) } : null;
}

const GEN = 'shred_cycle_gen:';
const readGen = async (storage, userId) => Number(await storage.get(GEN + userId)) || 0;

/** Recovery when stored data can't be unlocked: removes the record and the key, and invalidates every open tab. */
export async function resetCycleStorage({ storage, keys, userId, lock = null }) {
  const run = async () => { await storage.set(GEN + userId, String((await readGen(storage, userId)) + 1)); await storage.remove(PREFIX + userId); await keys.delete(userId); };
  return lock ? lock.run(run) : run();
}

export async function openCycleRepo({ storage, keys, userId, lock = null }) {
  if (!userId || typeof userId !== 'string') throw new CycleError('ACCESS_DENIED');
  subtle(); // fail early, before anything is written, if encryption is unavailable
  const slot = PREFIX + userId, local = memoryLock();
  const exclusive = fn => local.run(() => (lock ? lock.run(fn) : fn()));
  let key, state = blankState(userId), gen = 0, rev = 0, stale = false;

  /** Bring memory in line with storage. Throws STALE_SESSION if everything was deleted (by any tab) since we opened. */
  async function sync() {
    if (stale) throw new CycleError('STALE_SESSION');
    const g = await readGen(storage, userId);
    if (g !== gen) { stale = true; state = blankState(userId); key = null; throw new CycleError('STALE_SESSION'); }
    const text = await storage.get(slot);
    if (!text) { if (rev !== 0) { state = blankState(userId); rev = 0; } return; }
    const blob = parseBlob(text);
    if (blob.v >= 2 && blob.gen < gen) { await storage.remove(slot); state = blankState(userId); rev = 0; return; } // left by a tab after deletion: discard unread
    const r = blob.v >= 2 ? blob.rev : 0;
    if (r !== rev || state.owner !== userId || !state.consent) {
      const next = await decrypt(key, userId, blob);
      if (next.owner !== userId) throw new CycleError('ACCESS_DENIED');
      state = next; rev = r;
    }
  }

  await exclusive(async () => {
    gen = await readGen(storage, userId); key = await keys.get(userId);
    const text = await storage.get(slot);
    if (!text) return;
    const blob = parseBlob(text);
    if (blob.v >= 2 && blob.gen < gen) { await storage.remove(slot); return; }
    state = await decrypt(key, userId, blob); rev = blob.v >= 2 ? blob.rev : 0;
    if (state.owner !== userId) throw new CycleError('ACCESS_DENIED');
  });

  return {
    userId,
    get stale() { return stale; },
    /** A copy of the in-memory state. Call refresh() first to pick up changes from other tabs. */
    read: () => structuredClone(state),
    /** Re-read from storage. Resolves false (and empties memory) if the data was deleted elsewhere. */
    refresh: () => exclusive(sync).then(() => true, e => { if (e.code === 'STALE_SESSION') return false; throw e; }),
    /** Apply a change atomically to the LATEST stored data. If fn throws, nothing is saved. */
    update: fn => exclusive(async () => {
      await sync();
      const draft = structuredClone(state), out = fn(draft);
      if (draft.owner !== userId) throw new CycleError('ACCESS_DENIED');
      const nrev = rev + 1;
      await storage.set(slot, await encrypt(key, userId, draft, gen, nrev));
      if ((await readGen(storage, userId)) !== gen) { await storage.remove(slot); stale = true; state = blankState(userId); throw new CycleError('STALE_SESSION'); } // deleted meanwhile (no lock)
      state = draft; rev = nrev; return out;
    }),
    /** Everything this user has stored, decrypted, for the user to keep. */
    exportData: () => ({ format: 'shred-cycle-export', schema: SCHEMA, exportedAt: new Date().toISOString(),
      note: 'Your cycle data from Shred by QK. Keep this file private: it is not encrypted.', data: structuredClone(state) }),
    /** Delete everything: ciphertext and key. Waits for pending saves; invalidates every other open tab. */
    deleteAll: () => exclusive(async () => {
      gen = (await readGen(storage, userId)) + 1;
      await storage.set(GEN + userId, String(gen)); // first, so any other tab's pending write is refused
      await storage.remove(slot); await keys.delete(userId);
      state = blankState(userId); rev = 0; stale = false; key = await keys.get(userId);
      return { deleted: ['cycle records', 'symptom logs', 'reminders', 'wearable summaries', 'consent record', 'encryption key'],
        notReached: ['files you exported yourself', 'device or browser backups made before deletion (they hold only encrypted data, but may also hold the key)'] };
    }),
  };
}
