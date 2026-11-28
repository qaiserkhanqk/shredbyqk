// Tests for two additions suggested by the Natural Cycles comparison (docs/comparison-natural-cycles.md):
//   A. A summary for a doctor, created only when the person asks (js/cycle/summary.js).
//   B. Optional ovulation-test (LH) logging as a plain record, behind a research flag that is off by default.
// Written BEFORE the code. Synthetic data only. Run: node tests/cycle-summary-lh.test.mjs
import * as M from '../js/cycle/model.js';
import { estimateNext } from '../js/cycle/predict.js';
import { findPatterns, patternStatus } from '../js/cycle/patterns.js';
import { phaseInfo } from '../js/cycle/phase.js';
import { FLAG_DEFS, readFlags } from '../js/cycle/flags.js';
import { openCycleRepo, memoryStorage, memoryKeys } from '../js/cycle/store.js';
import { addDays } from '../js/cycle/dates.js';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const attempt = fn => { try { return { value: fn() }; } catch (e) { return { error: e }; } };
const TODAY = '2026-11-15';
let S = {};
try { S = await import('../js/cycle/summary.js'); } catch (e) { check('summary module exists (js/cycle/summary.js)', false, e.message); }
const summarise = (s, o = {}) => attempt(() => S.clinicianSummary(s, { today: TODAY, ...o }));
const text = sum => attempt(() => S.summaryText(sum)).value || '';
// A block that throws (e.g. because the feature doesn't exist yet) is reported as a failure, not a crash.
const guard = async (name, fn) => { try { await fn(); } catch (e) { check(`${name} ran without throwing`, false, e.code || e.message); } };

/** Synthetic person: 8 starts: 7 cycles of 29–31 days then one of 12 days (flagged for checking); the last period is still open, so the last period is still open. */
function person() {
  const s = M.blankState('synthetic'); M.giveConsent(s, '2026-01-01T00:00:00.000Z');
  const starts = ['2026-05-01', '2026-05-30', '2026-06-29', '2026-07-30', '2026-08-28', '2026-09-27', '2026-10-27', '2026-11-08'];
  for (const d of starts) M.logPeriodStart(s, d, { today: TODAY, at: `${d}T08:00:00.000Z` });
  for (const p of s.periods.slice(0, -1)) M.logPeriodEnd(s, p.id, addDays(p.start, 4), { today: TODAY, at: `${addDays(p.start, 4)}T08:00:00.000Z` });
  return s;
}

/* ---------------- A. Summary for a doctor ---------------- */
{
  const s = person();
  M.setCategory(s, 'pain', true); M.setCategory(s, 'mood', true); M.setCategory(s, 'sleep', true);
  M.logDay(s, '2026-10-27', { pain: 'severe', mood: 'low' }, { today: TODAY });
  M.logDay(s, '2026-10-28', { pain: 'moderate' }, { today: TODAY });
  M.logDay(s, '2026-11-08', { pain: 'mild' }, { today: TODAY });
  M.logDay(s, '2026-10-10', { bleeding: 'spotting' }, { today: TODAY });
  M.logDay(s, '2026-10-11', { bleeding: 'spotting', sleep: 'poor' }, { today: TODAY });
  M.setCategory(s, 'sleep', false); // turned off without deleting: its old entries stay stored but must not be summarised
  M.setSituation(s, 'perimenopause', true, { at: '2026-09-01T00:00:00.000Z' });
  M.setScopeConsent(s, 'wearable', true);
  s.wearable.nights.push({ night: '2026-11-01', metric: 'skin_temp', status: 'ok', value: 34.1234, flags: [] });
  const before = JSON.stringify(s);
  const r = summarise(s);
  check('A1 clinicianSummary() exists and returns a summary', !r.error && !!r.value, r.error?.message);
  const sum = r.value || {}, t = text(sum);
  check('A1 summary does not change the stored data', JSON.stringify(s) === before);
  check('A2 every logged period in the window is listed, oldest first', sum.periods?.length === 8 && sum.periods[0].start === '2026-05-01' && sum.periods.at(-1).start === '2026-11-08', JSON.stringify(sum.periods?.map(p => p.start)));
  const open = sum.periods?.at(-1);
  check('A2 an open period keeps no end date (none is invented) and says so in the text', open?.end === null && /end not (yet )?logged/i.test(t), JSON.stringify(open));
  check('A2 a closed period reports its logged length (start to end, inclusive)', sum.periods?.[0].days === 5, JSON.stringify(sum.periods?.[0]));
  check('A3 cycle lengths are listed from logged starts', sum.cycles?.length === 7 && sum.cycles[0].length === 29, JSON.stringify(sum.cycles?.map(c => c.length)));
  check('A3 shortest / longest / count are from usable cycles only', sum.cycleStats?.count === 6 && sum.cycleStats.shortest === 29 && sum.cycleStats.longest === 31, JSON.stringify(sum.cycleStats));
  check('A3 a cycle flagged for checking (12 days) is listed with its reason but kept out of the figures', sum.cycles?.at(-1)?.length === 12 && sum.cycles.at(-1).usable === false && !!sum.cycles.at(-1).reason);
  const pain = sum.symptoms?.find(x => x.category === 'pain');
  check('A4 symptoms: counts of each value for categories that are on', pain?.daysLogged === 3 && pain.counts.find(c => c.value === 'severe')?.days === 1 && pain.counts.find(c => c.value === 'moderate')?.days === 1, JSON.stringify(pain));
  check('A4 a category that is switched off is not summarised', !sum.symptoms?.some(x => x.category === 'sleep') && !/sleep/i.test(t.replace(/sleep(ing)? (is|was) not/i, '')), JSON.stringify(sum.symptoms?.map(x => x.category)));
  check('A4 a category that was never turned on is not mentioned as "none"', !sum.symptoms?.some(x => x.category === 'cravings'));
  check('A5 spotting days are counted separately from periods', sum.spottingDays === 2, String(sum.spottingDays));
  check('A5 the text says days without an entry are unknown, not "none"', /without an entry are unknown/i.test(t));
  check('A6 current situations are listed by their label', sum.situations?.some(x => /perimenopause/i.test(x.label)) && /perimenopause/i.test(t));
  check('A7 no estimate, prediction or fertility content: no estimate field, and none of these words in the text', !('estimate' in sum) && !/fertile|safe day|ovulation day|ovulated|predict(ed|ion)? (date|period)|next period/i.test(t), (t.match(/fertile|safe day|ovulation day|ovulated|next period/i) || [''])[0]);
  check('A7 no research outputs: no wearable or temperature data, no pattern findings', !('wearable' in sum) && !/°C|34\.12|temperature|you logged lower|around day/i.test(t));
  check('A8 the text says what it is and is not (made on request, from your own entries, not a diagnosis)', /not a diagnosis/i.test(t) && /your own entries/i.test(t) && /on request|you asked/i.test(t));
  check('A8 the text states the date it was made and the period it covers', t.includes(TODAY) && t.includes(sum.from || '?') && /^\d{4}-\d{2}-\d{2}$/.test(sum.from || ''));
  const est = estimateNext(s, TODAY);
  check('A7 the estimated range dates do not appear in the summary', !est.rangeStart || (!t.includes(est.rangeStart) && !t.includes(est.rangeEnd)), `${est.rangeStart}–${est.rangeEnd}`);
}
{
  const s = person();
  const r = summarise(s, { months: 3 });
  check('A9 the window can be shortened: 3 months leaves out older periods and cycles', r.value?.periods?.every(p => p.start >= '2026-08-15') && r.value?.cycles?.every(c => c.start >= '2026-08-15'), JSON.stringify(r.value?.periods?.map(p => p.start)));
  check('A9 an unsupported window is refused', !!summarise(s, { months: 0 }).error && !!summarise(s, { months: 'all' }).error);
  const none = M.blankState('synthetic');
  check('A10 nothing can be summarised before consent', summarise(none).error?.code === 'NO_CONSENT');
  const fresh = M.blankState('synthetic'); M.giveConsent(fresh);
  const e = summarise(fresh).value;
  check('A10 with no entries, the summary says nothing has been logged (no figures invented)', e && e.periods.length === 0 && e.cycleStats === null && /no periods logged/i.test(text(e)));
}

/* ---------------- B. Ovulation-test (LH) results as a plain record ---------------- */
check('B1 research flag lhTests exists and is off by default', FLAG_DEFS.lhTests?.default === false && readFlags({ getItem: () => null }).lhTests === false);
check('B1 LH is not a symptom category, so pattern, suggestion and forecast code never scan it', !('lh' in M.CATEGORIES));
await guard('B2', async () => {
  const s = person();
  check('B2 logging an LH result without opting in is refused', attempt(() => M.logDay(s, '2026-11-01', { lh: 'positive' }, { today: TODAY })).error?.code === 'LH_OFF');
  check('B2 opting in uses its own consent scope', !attempt(() => M.setScopeConsent(s, 'lhTests', true)).error && !!s.consent.lhTests);
  const ok = ['positive', 'negative', 'invalid'].map((v, i) => attempt(() => M.logDay(s, addDays('2026-11-01', i), { lh: v }, { today: TODAY })));
  check('B2 positive, negative and invalid results are accepted', ok.every(x => !x.error) && s.days['2026-11-01'].lh === 'positive' && s.days['2026-11-03'].lh === 'invalid');
  check('B2 any other value is refused', attempt(() => M.logDay(s, '2026-11-05', { lh: 'peak' }, { today: TODAY })).error?.code === 'INVALID_INPUT');
  check('B2 a future date is refused', attempt(() => M.logDay(s, '2026-11-20', { lh: 'negative' }, { today: TODAY })).error?.code === 'FUTURE_DATE');
  check('B2 a typed result is recorded with its source', s.days['2026-11-01']?.src?.lh === 'typed');
  check('B2 the LH labels make no fertility claim', Object.values(M.LH_RESULTS || {}).every(l => !/fertile|ovulat(ed|ing)|safe/i.test(l)) && Object.keys(M.LH_RESULTS || {}).length === 3);
});
await guard('B3–B5', async () => {
  // LH entries must change nothing the app works out. Same person with and without many positive results.
  const plain = person(), withLh = person();
  for (const st of [plain, withLh]) { M.setCategory(st, 'energy', true); for (const p of st.periods.slice(0, -2)) for (let k = 0; k < 28; k++) M.logDay(st, addDays(p.start, k), { energy: k === 13 || k === 14 ? 'low' : 'usual' }, { today: TODAY }); }
  M.setScopeConsent(withLh, 'lhTests', true);
  for (const p of withLh.periods.slice(0, -2)) for (const k of [12, 13, 14]) M.logDay(withLh, addDays(p.start, k), { lh: 'positive' }, { today: TODAY });
  const strip = o => JSON.parse(JSON.stringify(o));
  check('B3 the period estimate is identical with or without LH results', JSON.stringify(strip(estimateNext(plain, TODAY))) === JSON.stringify(strip(estimateNext(withLh, TODAY))));
  check('B3 phase information is identical with or without LH results (no ovulation inferred)', JSON.stringify(phaseInfo(plain, TODAY, { estimate: estimateNext(plain, TODAY) })) === JSON.stringify(phaseInfo(withLh, TODAY, { estimate: estimateNext(withLh, TODAY) })));
  check('B3 pattern findings are identical, and none is about LH', JSON.stringify(findPatterns(plain)) === JSON.stringify(findPatterns(withLh)) && !patternStatus(withLh).some(x => x.category === 'lh'));
  // History: a correction is versioned like other day fields.
  const s = person(); M.setScopeConsent(s, 'lhTests', true);
  M.logDay(s, '2026-11-01', { lh: 'positive' }, { today: TODAY, at: '2026-11-01T09:00:00.000Z' });
  M.logDay(s, '2026-11-01', { lh: 'invalid' }, { today: TODAY, at: '2026-11-03T09:00:00.000Z' });
  check('B4 a correction is versioned: the view as known on 2 Nov shows the earlier result', M.stateAsOf(s, '2026-11-02', { knownAt: '2026-11-02T12:00:00.000Z' }).days['2026-11-01']?.lh === 'positive' && s.days['2026-11-01'].lh === 'invalid');
  M.logDay(s, '2026-11-01', { lh: null }, { today: TODAY });
  check('B4 deleting a result removes it and its history', !s.days['2026-11-01']?.lh && !s.days['2026-11-01']?.hist?.lh);
  // Withdrawing consent deletes all LH results (and their history) but nothing else.
  M.setCategory(s, 'pain', true);
  M.logDay(s, '2026-11-02', { lh: 'negative', pain: 'mild' }, { today: TODAY });
  M.setScopeConsent(s, 'lhTests', false);
  check('B5 turning LH logging off deletes every LH result and its history', !Object.values(s.days).some(d => 'lh' in d || d.hist?.lh || d.src?.lh || d.rec?.lh));
  check('B5 other entries on the same day are kept', s.days['2026-11-02']?.pain === 'mild');
  check('B5 the consent record notes the change', s.consent.log.some(l => l.change === 'lhTests:off'));
});
await guard('B6', async () => {
  // Summary and LH together: listed as recorded only while LH logging is on.
  const s = person(); M.setScopeConsent(s, 'lhTests', true);
  M.logDay(s, '2026-10-09', { lh: 'negative' }, { today: TODAY }); M.logDay(s, '2026-10-10', { lh: 'positive' }, { today: TODAY });
  const sum = summarise(s).value, t = text(sum);
  check('B6 the summary lists LH results by date, as recorded', sum?.lhTests?.length === 2 && sum.lhTests[1].date === '2026-10-10' && sum.lhTests[1].result === 'positive' && /2026-10-10.*positive/i.test(t), JSON.stringify(sum?.lhTests));
  check('B6 the summary says LH results are not interpreted', /not interpreted/i.test(t));
  const s2 = person();
  check('B6 without LH logging, the summary has no LH section', summarise(s2).value?.lhTests === null && !/LH/.test(text(summarise(s2).value)));
});
await guard('B7', async () => {
  // Export and delete-all cover LH results (encrypted repository, synthetic data).
  const repo = await openCycleRepo({ storage: memoryStorage(), keys: memoryKeys(), userId: 'synthetic' });
  await repo.update(s => { M.giveConsent(s); M.setScopeConsent(s, 'lhTests', true); M.logDay(s, '2026-11-01', { lh: 'positive' }, { today: TODAY }); });
  check('B7 export includes LH results', repo.exportData().data.days['2026-11-01']?.lh === 'positive');
  await repo.deleteAll();
  check('B7 delete-all removes LH results', !repo.read().days['2026-11-01'] && !repo.read().consent.lhTests);
});

console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
