// Cycle tracking integration tests: encrypted repository + model + reminders + wearable adapter, end to end.
// Synthetic data only. Run: node tests/cycle-integration.test.mjs
import * as M from '../js/cycle/model.js';
import { openCycleRepo, memoryStorage, memoryKeys } from '../js/cycle/store.js';
import { estimateNext } from '../js/cycle/predict.js';
import { addReminder, dueNow } from '../js/cycle/reminders.js';
import { MockWearable, normalise, summariseNights, mergeNights } from '../js/cycle/wearables.js';
import { addDays } from '../js/cycle/dates.js';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const rejects = async (p, code) => p.then(() => false, e => e.code === code);
const T = '2026-11-14';

const storage = memoryStorage(), keys = memoryKeys();
const alice = await openCycleRepo({ storage, keys, userId: 'alice' });

// 1. Consent gate
check('repo: new user starts empty with no consent', !M.hasConsent(alice.read()) && alice.read().periods.length === 0);
check('repo: writes before consent are refused and nothing is saved', await rejects(alice.update(s => M.logPeriodStart(s, '2026-10-01', { today: T })), 'NO_CONSENT') && storage.raw.size === 0);
await alice.update(s => M.giveConsent(s));

// 2. Log a history, reopen, estimate
for (const d of ['2026-06-02', '2026-07-01', '2026-07-31', '2026-08-30', '2026-09-28', '2026-10-28']) await alice.update(s => { const p = M.logPeriodStart(s, d, { today: T }); M.logPeriodEnd(s, p.id, addDays(d, 4), { today: T }); });
await alice.update(s => M.logDay(s, '2026-11-10', { bleeding: 'spotting' }, { today: T }));
const again = await openCycleRepo({ storage, keys, userId: 'alice' });
const est = estimateNext(again.read(), T);
check('repo: data survives reopening (decrypts with the same key)', again.read().periods.length === 6 && again.read().days['2026-11-10'].bleeding === 'spotting');
check('estimate after reopen: range from own history', est.status === 'estimate' && est.rangeStart && est.rangeEnd, `${est.rangeStart}–${est.rangeEnd}`);

// 3. Atomic update: a failing change leaves stored data untouched
const before = storage.raw.get('shred_cycle_v1:alice');
check('repo: a failed edit saves nothing', await rejects(again.update(s => { s.periods = []; M.logPeriodStart(s, '2026-12-25', { today: T }); }), 'FUTURE_DATE') && storage.raw.get('shred_cycle_v1:alice') === before && again.read().periods.length === 6);

// 4. Stored bytes are ciphertext
const raw = storage.raw.get('shred_cycle_v1:alice');
check('at rest: stored value is AES-GCM ciphertext, no dates or words in it', /AES-GCM/.test(raw) && !/2026-|spotting|period/.test(raw));

// 5. Cross-user isolation
const bob = await openCycleRepo({ storage, keys, userId: 'bob' });
check('isolation: another user sees none of Alice\'s data', bob.read().periods.length === 0 && bob.read().owner === 'bob');
await bob.update(s => M.giveConsent(s));
await bob.update(s => M.logPeriodStart(s, '2026-11-01', { today: T }));
check('isolation: Bob\'s writes never touch Alice\'s record', (await openCycleRepo({ storage, keys, userId: 'alice' })).read().periods.length === 6);
storage.raw.set('shred_cycle_v1:bob', storage.raw.get('shred_cycle_v1:alice'));
check('isolation: Alice\'s blob copied into Bob\'s slot cannot be decrypted', await rejects(openCycleRepo({ storage, keys, userId: 'bob' }), 'DECRYPT_FAILED'));
const shared = memoryKeys(), st2 = memoryStorage();
const a2 = await openCycleRepo({ storage: st2, keys: { get: () => shared.get('same'), delete: () => {} }, userId: 'alice' });
await a2.update(s => M.giveConsent(s));
st2.raw.set('shred_cycle_v1:bob', st2.raw.get('shred_cycle_v1:alice'));
check('isolation: even with the same key, a blob bound to another user ID is rejected', await rejects(openCycleRepo({ storage: st2, keys: { get: () => shared.get('same'), delete: () => {} }, userId: 'bob' }), 'DECRYPT_FAILED'));
check('isolation: a change can\'t reassign the owner', await rejects(alice.update(s => { s.owner = 'mallory'; }), 'ACCESS_DENIED'));
check('isolation: no user ID → access denied', await rejects(openCycleRepo({ storage, keys, userId: '' }), 'ACCESS_DENIED'));
const tampered = JSON.parse(storage.raw.get('shred_cycle_v1:alice')); tampered.ct = tampered.ct.slice(0, -4) + 'AAAA';
const st3 = memoryStorage(); st3.raw.set('shred_cycle_v1:alice', JSON.stringify(tampered));
check('integrity: tampered ciphertext is rejected, not half-read', await rejects(openCycleRepo({ storage: st3, keys, userId: 'alice' }), 'DECRYPT_FAILED'));

// 6. Crypto unavailable → refuse, never plaintext
const realCrypto = globalThis.crypto;
Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
const st4 = memoryStorage();
check('no WebCrypto: repository refuses to open (no plaintext fallback)', await rejects(openCycleRepo({ storage: st4, keys: memoryKeys(), userId: 'x' }), 'CRYPTO_UNAVAILABLE') && st4.raw.size === 0);
Object.defineProperty(globalThis, 'crypto', { value: realCrypto, configurable: true });

// 7. Consent changes: symptoms, reminders, wearable
await alice.update(s => M.setCategory(s, 'pain', true));
await alice.update(s => M.logDay(s, '2026-10-29', { pain: 'moderate' }, { today: T }));
await alice.update(s => M.setCategory(s, 'pain', false, { purge: true }));
check('consent change: turning off a category with delete removes its entries from storage', !(await openCycleRepo({ storage, keys, userId: 'alice' })).read().days['2026-10-29']);
await alice.update(s => M.setScopeConsent(s, 'reminders', true));
await alice.update(s => addReminder(s, { kind: 'dailyLog', time: '08:00' }));
check('reminders: due after their time, with neutral text', dueNow(alice.read(), { today: T, nowMin: 9 * 60, estimate: est })[0]?.content.body === 'You have a check-in.');

// 8. Wearable: consent → adapter → normalise → summaries stored; withdraw → deleted
check('wearable: ingest refused without wearable consent', !alice.read().consent.wearable);
await alice.update(s => M.setScopeConsent(s, 'wearable', true));
const dev = new MockWearable({ seed: 11 }); const info = await dev.connect();
const { readings, stats } = normalise(await dev.fetchPackets({ from: '2026-10-28', to: '2026-11-12' }), { now: Date.parse(T + 'T09:00:00Z') });
await alice.update(s => { s.wearable.devices = [{ ...info, adapter: dev.id, verified: dev.verified }]; s.wearable.nights = mergeNights(s.wearable.nights, summariseNights(readings)); });
const w = alice.read().wearable;
check('wearable: nightly summaries stored with source, model, firmware, unit and flags', w.nights.length > 10 && w.nights.every(n => n.deviceId && n.model && n.firmware && n.unit && Array.isArray(n.flags)));
check('wearable: raw samples are not stored (data minimisation)', !('readings' in w) && JSON.stringify(w).length < 40000 && stats.received > 500);
check('wearable: a watch never creates or edits a period', alice.read().periods.length === 6);
await alice.update(s => M.setScopeConsent(s, 'wearable', false));
check('wearable consent withdrawn: summaries and device deleted', alice.read().wearable.nights.length === 0 && alice.read().wearable.devices.length === 0);

// 9. Export and delete
const exp = alice.exportData();
check('export: the user gets all their data in a readable file', exp.format === 'shred-cycle-export' && exp.data.periods.length === 6 && exp.data.consent.log.length > 3);
const report = await alice.deleteAll();
check('delete: record and key removed', !storage.raw.has('shred_cycle_v1:alice') && report.deleted.includes('encryption key'));
check('delete: reports what it cannot reach (exports, backups)', report.notReached.some(x => /export/.test(x)) && report.notReached.some(x => /backup/.test(x)));
const fresh = await openCycleRepo({ storage, keys, userId: 'alice' });
check('delete: reopening gives an empty state that needs consent again', fresh.read().periods.length === 0 && !M.hasConsent(fresh.read()));
check('delete: other users are untouched', storage.raw.has('shred_cycle_v1:bob'));
storage.raw.set('shred_cycle_v1:alice', before);
check('delete: an old backup of the ciphertext is unreadable once the key is destroyed', await rejects(openCycleRepo({ storage, keys, userId: 'alice' }), 'DECRYPT_FAILED'));

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
