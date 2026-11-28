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
//  • Concurrency (fixes for issues 1 and 2 reproduced in 0f26696): every write is an ATOMIC compare-and-swap on
//    (generation, revision). In the browser this is one IndexedDB readwrite transaction, which the browser
//    serialises across tabs, so it is safe with or without the Web Locks API. A write that lost a race is re-run on
//    the fresh data; after repeated losses it fails with the retryable CONFLICT error and saves nothing.
//    Deletion is an atomic "bump generation + remove record". Keys are created with an atomic create-if-absent,
//    one key per generation, so tabs that open at the same moment always share a key.
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

/* ---------- Keys: one per (user, generation), created atomically ----------
   Generation 0 uses the bare user ID as its name (compatible with keys created by earlier versions). */
const keyName = (userId, gen = 0) => (gen ? `${userId}#${gen}` : userId);
const newKey = () => subtle().generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
const keyGenOf = (name, userId) => (name === userId ? 0 : name.startsWith(userId + '#') ? Number(name.slice(userId.length + 1)) : null);

/** In-memory key provider (tests and Node). get() is create-if-absent: the check and the write happen with no await between. */
export function memoryKeys() {
  const m = new Map();
  return {
    async get(userId, gen = 0) { const cand = await newKey(), n = keyName(userId, gen); if (!m.has(n)) m.set(n, cand); return m.get(n); },
    /** Delete this user's keys for generations below `below` (all if omitted). */
    async delete(userId, { below = Infinity } = {}) { for (const n of [...m.keys()]) { const g = keyGenOf(n, userId); if (g != null && g < below) m.delete(n); } },
    has: (userId, gen = 0) => m.has(keyName(userId, gen)),
    raw: m,
  };
}

/* ---------- IndexedDB (browser) ----------
   One database holds keys, encrypted records and per-user metadata (generation), so every check-and-write is a
   single transaction. Version 2 adds 'records' and 'meta' to the version-1 'keys' store. */
const DB = 'shred_cycle_keys';
function openDb(dbName = DB) {
  return new Promise((res, rej) => {
    const r = indexedDB.open(dbName, 2);
    r.onupgradeneeded = () => { for (const st of ['keys', 'records', 'meta']) if (!r.result.objectStoreNames.contains(st)) r.result.createObjectStore(st); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(new CycleError('KEYSTORE_UNAVAILABLE')); r.onblocked = () => rej(new CycleError('KEYSTORE_UNAVAILABLE'));
  });
}
/** Run `body(stores, done)` in one transaction; resolves with the value passed to done() once the transaction commits. */
async function inTx(dbName, names, mode, body) {
  const db = await openDb(dbName);
  return new Promise((res, rej) => {
    let out; const t = db.transaction(names, mode), st = Object.fromEntries(names.map(n => [n, t.objectStore(n)]));
    body(st, v => { out = v; });
    t.oncomplete = () => { db.close(); res(out); };
    t.onerror = t.onabort = () => { db.close(); rej(new CycleError('KEYSTORE_UNAVAILABLE')); };
  });
}

/** Browser key provider: non-extractable keys in IndexedDB, created with an atomic create-if-absent transaction. */
export function indexedDbKeys(dbName = DB) {
  return {
    async get(userId, gen = 0) {
      const cand = await newKey(), n = keyName(userId, gen); // generate first: no await may happen inside a transaction
      return inTx(dbName, ['keys'], 'readwrite', ({ keys }, done) => {
        const q = keys.get(n);
        q.onsuccess = () => { if (q.result) done(q.result); else { keys.put(cand, n); done(cand); } };
      });
    },
    async delete(userId, { below = Infinity } = {}) {
      return inTx(dbName, ['keys'], 'readwrite', ({ keys }) => {
        const q = keys.getAllKeys();
        q.onsuccess = () => { for (const n of q.result) { const g = keyGenOf(String(n), userId); if (g != null && g < below) keys.delete(n); } };
      });
    },
  };
}

const GEN = 'shred_cycle_gen:';
const revOf = blob => (blob.v >= 2 ? blob.rev : 0);
const parseBlob = text => { try { return JSON.parse(text); } catch { throw new CycleError('CORRUPT'); } };
const currentRev = text => (text ? revOf(parseBlob(text)) : 0);

/** In-memory storage (tests and Node). The atomic operations do their check and write with no await in between. */
export function memoryStorage() {
  const m = new Map(), gen = u => Number(m.get(GEN + u)) || 0;
  return {
    raw: m,
    get: async k => m.get(k) ?? null, set: async (k, v) => { m.set(k, v); }, remove: async k => { m.delete(k); },
    async snapshot(u) { return { gen: gen(u), text: m.get(PREFIX + u) ?? null }; },
    async cas(u, { gen: g, baseRev, text }) {
      if (gen(u) !== g) return 'stale';
      if (currentRev(m.get(PREFIX + u)) !== baseRev) return 'conflict';
      if (text == null) m.delete(PREFIX + u); else m.set(PREFIX + u, text); return 'ok'; // text null = remove
    },
    async wipe(u) { const g = gen(u) + 1; m.set(GEN + u, String(g)); m.delete(PREFIX + u); return g; },
    async importIfEmpty(u, text, g) { if (m.has(PREFIX + u)) return false; m.set(PREFIX + u, text); m.set(GEN + u, String(g)); return true; },
    async userId() { if (!m.has('__uid__')) m.set('__uid__', globalThis.crypto.randomUUID()); return m.get('__uid__'); },
  };
}

/** Browser storage: encrypted records and generations in IndexedDB, every check-and-write in one transaction. */
export function indexedDbStorage(dbName = DB) {
  return {
    snapshot: u => inTx(dbName, ['records', 'meta'], 'readonly', ({ records, meta }, done) => {
      const g = meta.get(u), r = records.get(u);
      r.onsuccess = () => done({ gen: Number(g.result) || 0, text: r.result ?? null });
    }),
    cas: (u, { gen, baseRev, text }) => inTx(dbName, ['records', 'meta'], 'readwrite', ({ records, meta }, done) => {
      const g = meta.get(u);
      g.onsuccess = () => {
        if ((Number(g.result) || 0) !== gen) return done('stale');
        const r = records.get(u);
        r.onsuccess = () => { let cur; try { cur = currentRev(r.result); } catch { cur = -1; } if (cur !== baseRev) return done('conflict'); if (text == null) records.delete(u); else records.put(text, u); done('ok'); };
      };
    }),
    wipe: u => inTx(dbName, ['records', 'meta'], 'readwrite', ({ records, meta }, done) => {
      const g = meta.get(u);
      g.onsuccess = () => { const n = (Number(g.result) || 0) + 1; meta.put(n, u); records.delete(u); done(n); };
    }),
    importIfEmpty: (u, text, gen) => inTx(dbName, ['records', 'meta'], 'readwrite', ({ records, meta }, done) => {
      const r = records.get(u);
      r.onsuccess = () => { if (r.result != null) return done(false); records.put(text, u); meta.put(gen, u); done(true); };
    }),
    /** The device's local user ID, created atomically (two tabs opening at once get the same ID). */
    userId: (candidate = globalThis.crypto.randomUUID()) => inTx(dbName, ['meta'], 'readwrite', ({ meta }, done) => {
      const q = meta.get('__uid__');
      q.onsuccess = () => { if (q.result) done(q.result); else { meta.put(candidate, '__uid__'); done(candidate); } };
    }),
  };
}

/** A random local user ID for this device (not health data). A multi-user product needs real accounts.
 *  Prefer `await storage.userId()`, which is atomic; this localStorage version is kept for older callers. */
export function localUserId(ls = globalThis.localStorage) {
  let id = ls.getItem('shred_cycle_uid');
  if (!id) { id = globalThis.crypto.randomUUID(); ls.setItem('shred_cycle_uid', id); }
  return id;
}

/** One-time move of records written to localStorage by earlier prototype versions into the transactional store. */
export async function migrateLegacyLocalStorage({ ls = globalThis.localStorage, storage, userId }) {
  const text = ls?.getItem(PREFIX + userId); if (!text) return false;
  const moved = await storage.importIfEmpty(userId, text, Number(ls.getItem(GEN + userId)) || 0);
  ls.removeItem(PREFIX + userId); ls.removeItem(GEN + userId);
  return moved;
}

/* AAD binds the user ID and, for v2 records, the generation and revision, so a record can't be moved to another
   user, replayed into another generation, or have its revision number edited without failing to decrypt. */
const aadFor = (userId, blob) => (blob.v >= 2 ? enc.encode(`shred-cycle|${userId}|v2|${blob.gen}|${blob.rev}`) : aad(userId));

async function encrypt(key, userId, obj, gen, rev) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12)), meta = { v: 2, gen, rev };
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: aadFor(userId, meta) }, key, enc.encode(JSON.stringify(obj))));
  return JSON.stringify({ ...meta, alg: 'AES-GCM-256', iv: b64(iv), ct: b64(ct) });
}
async function decrypt(key, userId, blob) {
  try {
    const pt = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(blob.iv), additionalData: aadFor(userId, blob) }, key, unb64(blob.ct));
    return JSON.parse(dec.decode(pt));
  } catch { throw new CycleError('DECRYPT_FAILED'); }
}

/* ---------- Serialisation helpers ----------
   localQueue: one operation at a time inside a tab. lock: optional cross-tab mutex (Web Locks) that only reduces
   conflicts; correctness comes from the atomic compare-and-swap above, so it is safe when no lock exists. */
export function memoryLock() {
  let chain = Promise.resolve();
  return { run(fn) { const p = chain.then(() => fn()); chain = p.catch(() => {}); return p; } };
}
export function webLock(name) {
  return globalThis.navigator?.locks ? { run: fn => globalThis.navigator.locks.request(name, () => fn()) } : null;
}

const requireAtomic = storage => { if (typeof storage?.cas !== 'function' || typeof storage?.wipe !== 'function' || typeof storage?.snapshot !== 'function') throw new CycleError('STORAGE_NOT_ATOMIC'); };

/** Recovery when stored data can't be unlocked: removes the record and old keys, and invalidates every open tab. */
export async function resetCycleStorage({ storage, keys, userId, lock = null }) {
  requireAtomic(storage);
  const run = async () => { const g = await storage.wipe(userId); await keys.delete(userId, { below: g }); };
  return lock ? lock.run(run) : run();
}

export async function openCycleRepo({ storage, keys, userId, lock = null, notify = null, maxRetries = 5 }) {
  if (!userId || typeof userId !== 'string') throw new CycleError('ACCESS_DENIED');
  subtle(); // fail early, before anything is written, if encryption is unavailable
  requireAtomic(storage);
  const local = memoryLock();
  const exclusive = fn => local.run(() => (lock ? lock.run(fn) : fn()));
  let key = null, state = blankState(userId), gen = 0, rev = 0, stale = false, loaded = false;

  /** Bring memory in line with storage. Throws STALE_SESSION if everything was deleted (by any tab) since we opened. */
  async function sync() {
    if (stale) throw new CycleError('STALE_SESSION');
    const snap = await storage.snapshot(userId);
    if (snap.gen !== gen) { stale = true; state = blankState(userId); key = null; throw new CycleError('STALE_SESSION'); }
    if (!snap.text) { if (rev !== 0 || !loaded) { state = blankState(userId); rev = 0; } loaded = true; return; }
    const blob = parseBlob(snap.text), r = revOf(blob);
    if (blob.v >= 2 && blob.gen < gen) { // left over from before a deletion: never decrypted, removed atomically
      const res = await storage.cas(userId, { gen, baseRev: r, text: null });
      if (res === 'stale') { stale = true; state = blankState(userId); key = null; throw new CycleError('STALE_SESSION'); }
      state = blankState(userId); rev = 0; loaded = true; return;
    }
    if (r !== rev || !loaded) {
      const next = await decrypt(key, userId, blob);
      if (next.owner !== userId) throw new CycleError('ACCESS_DENIED');
      state = next; rev = r; loaded = true;
    }
  }

  await exclusive(async () => {
    gen = (await storage.snapshot(userId)).gen;
    key = await keys.get(userId, gen);
    await sync();
  });

  return {
    userId,
    get stale() { return stale; },
    /** A copy of the in-memory state. Call refresh() first to pick up changes from other tabs. */
    read: () => structuredClone(state),
    /** Re-read from storage. Resolves false (and empties memory) if the data was deleted elsewhere. */
    refresh: () => exclusive(sync).then(() => true, e => { if (e.code === 'STALE_SESSION') return false; throw e; }),
    /** Apply a change to the LATEST stored data with an atomic compare-and-swap. If another tab saved first, the
     *  change is re-applied to the fresh data; after maxRetries it fails with CONFLICT and nothing is saved. */
    update: fn => exclusive(async () => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        await sync();
        const draft = structuredClone(state), out = fn(draft);
        if (draft.owner !== userId) throw new CycleError('ACCESS_DENIED');
        const text = await encrypt(key, userId, draft, gen, rev + 1);
        const res = await storage.cas(userId, { gen, baseRev: rev, text });
        if (res === 'ok') { state = draft; rev += 1; notify?.(); return out; }
        if (res === 'stale') { stale = true; state = blankState(userId); key = null; throw new CycleError('STALE_SESSION'); }
      }
      throw new CycleError('CONFLICT');
    }),
    /** Everything this user has stored, decrypted, for the user to keep. */
    exportData: () => ({ format: 'shred-cycle-export', schema: SCHEMA, exportedAt: new Date().toISOString(),
      note: 'Your cycle data from Shred by QK. Keep this file private: it is not encrypted.', data: structuredClone(state) }),
    /** Delete everything: atomically bump the generation and remove the record, then destroy older keys. */
    deleteAll: () => exclusive(async () => {
      gen = await storage.wipe(userId);
      await keys.delete(userId, { below: gen });
      key = await keys.get(userId, gen); state = blankState(userId); rev = 0; stale = false; loaded = true;
      notify?.();
      return { deleted: ['cycle records', 'symptom logs', 'reminders', 'wearable summaries', 'consent record', 'encryption key'],
        notReached: ['files you exported yourself', 'device or browser backups made before deletion (they hold only encrypted data, but may also hold the key)'] };
    }),
  };
}
