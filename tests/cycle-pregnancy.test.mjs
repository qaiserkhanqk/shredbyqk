// Pregnancy and postpartum modes (flag pregnancyMode, default OFF). Written BEFORE the implementation; the failing
// run is committed in docs/test-logs/. Synthetic data only. Run: node tests/cycle-pregnancy.test.mjs
// Sources for every number here are in docs/pregnancy-postpartum-evidence.md (ACOG CO 700, ACOG CO 579, ACOG CO 736,
// Jackson & Glasier 2011, Rezaie-Keikhaie 2020, CDC Hear Her). The app never detects or suggests a pregnancy:
// she tells it.
import * as M from '../js/cycle/model.js';
import { addDays } from '../js/cycle/dates.js';
import { estimateNext } from '../js/cycle/predict.js';
import { learningStage } from '../js/cycle/learning.js';
import { FLAG_DEFS, readFlags } from '../js/cycle/flags.js';
import { companionToday, answerCheckIn } from '../js/cycle/companion.js';
import { FORBIDDEN } from '../research/lib/policy.js';

let fails = 0, count = 0;
const check = (n, ok, d = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${!ok && d ? '  — ' + d : ''}`); };
const run = (label, fn) => { try { fn(); } catch (e) { check(`${label} ran to the end`, false, e.stack.split('\n').slice(0, 2).join(' ')); } };
let P = {}; try { P = await import('../js/cycle/pregnancy.js'); } catch (e) { check('module js/cycle/pregnancy.js exists', false, e.message); }
const AT = '2026-06-30T08:00:00.000Z';
const words = v => JSON.stringify(v);
const clean = v => !FORBIDDEN.some(([, re]) => re.test(words(v)));
const err = fn => { try { fn(); return null; } catch (e) { return e.code; } };
const fresh = () => { const s = M.blankState('u'); M.giveConsent(s, '2026-01-01T00:00:00.000Z'); return s; };
/** Six 28-day cycles before the pregnancy; last period 2026-03-02. */
function withCycles() { const s = fresh(); for (let i = 0; i < 7; i++) { const d = addDays('2025-09-15', 28 * i); M.logPeriodStart(s, d, { today: '2026-03-10', at: `${d}T09:00:00.000Z` }); } return s; }

run('flag', () => {
  check('a separate flag, off by default', FLAG_DEFS.pregnancyMode?.default === false && readFlags({ getItem: () => null }).pregnancyMode === false);
});

run('starting pregnancy mode', () => {
  check('due date from the first day of her last period = +280 days (ACOG CO 700)', P.dueDateFromLmp?.('2026-03-02') === '2026-12-07');
  const s = withCycles();
  P.startPregnancy(s, { lmp: '2026-03-02', today: '2026-06-30', at: AT });
  check('she tells the app: the pregnant situation is on', s.situation.pregnant === true && s.pregnancy?.dueDate === '2026-12-07' && s.pregnancy.dueSource === 'lmp');
  const c = fresh(); P.startPregnancy(c, { dueDate: '2026-12-01', today: '2026-06-30', at: AT });
  check('a due date from her midwife or doctor can be entered directly', c.pregnancy.dueDate === '2026-12-01' && c.pregnancy.dueSource === 'clinician');
  check('a due date from her midwife or doctor replaces the calculated one', (P.setDueDate(s, '2026-12-03', { today: '2026-06-30', at: AT }), s.pregnancy.dueDate === '2026-12-03' && s.pregnancy.dueSource === 'clinician'));
  check('needs a due date or a last-period date', err(() => P.startPregnancy(fresh(), { today: '2026-06-30', at: AT })) === 'INVALID_INPUT');
  check('last period in the future is refused', err(() => P.startPregnancy(fresh(), { lmp: '2026-07-10', today: '2026-06-30', at: AT })) === 'FUTURE_DATE');
  check('a due date more than 44 weeks away or long past is refused', err(() => P.startPregnancy(fresh(), { dueDate: '2027-06-01', today: '2026-06-30', at: AT })) === 'OUT_OF_RANGE' && err(() => P.startPregnancy(fresh(), { dueDate: '2026-04-01', today: '2026-06-30', at: AT })) === 'OUT_OF_RANGE');
  check('no consent: refused', err(() => P.startPregnancy(M.blankState('x'), { lmp: '2026-03-02', today: '2026-06-30', at: AT })) === 'NO_CONSENT');
  check('dates-only estimates pause in pregnancy (unchanged behaviour)', estimateNext(s, '2026-06-30').status === 'paused');
});

run('weeks and trimesters', () => {
  const s = fresh(); P.startPregnancy(s, { dueDate: '2026-12-07', today: '2026-06-30', at: AT }); // = LMP 2026-03-02
  const t = P.pregnancyToday(s, '2026-06-30');
  check('17 weeks and 1 day on 2026-06-30', t?.week === 17 && t.day === 1 && /17 weeks and 1 day/.test(t.weeksText), words(t));
  check('second trimester (14+0 to 27+6, ACOG)', t.trimester === 2);
  check('first trimester at 13+6', P.pregnancyToday(s, addDays('2026-03-02', 13 * 7 + 6)).trimester === 1);
  check('third trimester from 28+0', P.pregnancyToday(s, addDays('2026-03-02', 28 * 7)).trimester === 3);
  check('days to her due date', t.daysToDue === 160);
  check('the due date is described as an estimate, and her scan date comes first', /estimate/i.test(t.dueNote) && /scan/i.test(t.dueNote), t.dueNote);
  const t37 = P.pregnancyToday(s, addDays('2026-03-02', 37 * 7));
  check('from 37 weeks: babies are considered term from 37 weeks (ACOG CO 579)', /37 weeks/.test(t37.stageNote || ''), t37.stageNote);
  const t42 = P.pregnancyToday(s, addDays('2026-03-02', 42 * 7));
  check('from 42 weeks: talk to your midwife or doctor today', /42 weeks/.test(t42.stageNote) && /midwife or doctor/i.test(t42.stageNote), t42.stageNote);
  check('urgent warning signs are always included, with a "get help now" instruction', t.warningSigns?.length >= 8 && /now|urgent|emergency/i.test(t.warningIntro), t.warningIntro);
  check('includes baby moving less (don\'t wait) and bleeding or fluid leaking', t.warningSigns.some(w => /moving less|movements/i.test(w)) && t.warningSigns.some(w => /bleeding/i.test(w)) && t.warningSigns.some(w => /fluid/i.test(w)));
  check('sources are shown', P.SOURCES && Object.values(P.SOURCES).filter(x => x.doi || x.url).length >= 5);
  check('no forbidden wording', clean(t));
  check('not pregnant: null', P.pregnancyToday(fresh(), '2026-06-30') === null);
});

run('pregnancy symptoms', () => {
  const pc = Object.entries(M.CATEGORIES).filter(([, c]) => c.group === 'pregnancy').map(([k]) => k);
  check('pregnancy symptom categories exist (group "pregnancy")', ['nausea', 'heartburn', 'swelling', 'backPain'].every(k => pc.includes(k)), pc.join(','));
  check('swelling says sudden swelling of face or hands needs a call now', /face|hands/i.test(M.CATEGORIES.swelling?.why || ''));
  const pp = Object.entries(M.CATEGORIES).filter(([, c]) => c.group === 'postpartum').map(([k]) => k);
  check('postpartum categories exist (bleeding after birth, healing pain)', pp.includes('afterBirthBleeding') && pp.includes('healingPain'), pp.join(','));
});

run('birth → postpartum', () => {
  const s = withCycles(); P.startPregnancy(s, { lmp: '2026-03-02', today: '2026-06-30', at: AT });
  P.endPregnancy(s, { outcome: 'birth', date: '2026-12-01', today: '2026-12-02', at: '2026-12-02T08:00:00.000Z' });
  check('after birth: pregnant off, postpartum on, kept in her history', !s.situation.pregnant && s.situation.postpartum === true && s.pregnancies?.at(-1)?.endDate === '2026-12-01' && s.pregnancies.at(-1).outcome === 'birth' && !s.pregnancy);
  const p = P.postpartumToday(s, '2026-12-11');
  check('days and weeks since birth', p?.daysSinceBirth === 10 && p.weeksText === '1 week and 3 days', words(p));
  check('bleeding after birth is not a period, and usually settles within about 6 weeks', /not a period/i.test(p.bleedingNote) && /6 weeks/.test(p.bleedingNote), p.bleedingNote);
  check('baby blues: common in the first 2 weeks; if low mood lasts longer, talk to someone', /2 weeks/.test(p.moodNote) && /midwife|doctor|health visitor/i.test(p.moodNote), p.moodNote);
  check('postnatal care: contact within 3 weeks and a full check by 12 weeks (ACOG CO 736)', /3 weeks/.test(p.checkNote) && /12 weeks/.test(p.checkNote), p.checkNote);
  check('periods: can take months to return, and pregnancy is possible before the first period', /before your first period/i.test(p.periodsNote), p.periodsNote);
  check('postpartum warning signs include heavy bleeding, chest pain and thoughts of harming yourself', ['heavy bleeding|soaking', 'chest pain', 'harm'].every(w => p.warningSigns.some(x => new RegExp(w, 'i').test(x))));
  check('no forbidden wording', clean(p));
  check('heavy bleeding after birth logged: an urgent alert', P.postpartumAlerts?.(s, { afterBirthBleeding: 'heavy' })?.some(a => a.level === 'urgent'));
});

run('estimates restart after a pregnancy', () => {
  const s = withCycles(); P.startPregnancy(s, { lmp: '2026-03-02', today: '2026-06-30', at: AT });
  P.endPregnancy(s, { outcome: 'birth', date: '2026-12-01', today: '2026-12-02', at: AT });
  const e0 = estimateNext(s, '2027-02-01');
  check('right after: no estimate from pre-pregnancy cycles, with a plain reason', e0.status === 'none' && /pregnan/i.test(e0.detail), words(e0.detail));
  M.logPeriodStart(s, '2027-03-01', { today: '2027-03-01', at: AT }); M.logPeriodStart(s, '2027-04-02', { today: '2027-04-02', at: AT });
  const e1 = estimateNext(s, '2027-04-05');
  check('the gap that includes the pregnancy is never used as a cycle', !e1.used?.some(c => c.start === '2026-03-02'), words(e1.used));
  check('estimates use only cycles after the pregnancy', e1.status === 'early' && e1.lengths.length === 1 && e1.lengths[0] === 32, words(e1.lengths));
  check('the learning stage restarts too', learningStage(s, '2027-04-05').usableCycles === 1);
  check('postpartum caveat still shown', e1.notes.some(n => /after birth/i.test(n)));
});

run('a pregnancy that ended', () => {
  const s = withCycles(); P.startPregnancy(s, { lmp: '2026-03-02', today: '2026-04-20', at: AT });
  const r = P.endPregnancy(s, { outcome: 'ended', date: '2026-04-20', today: '2026-04-20', at: AT });
  check('she is not asked why; pregnancy mode ends; not switched to postpartum', !s.situation.pregnant && !s.situation.postpartum && s.pregnancies.at(-1).outcome === 'ended');
  check('a gentle message with where to get support, no blame and no medical claims', /sorry/i.test(r?.message || '') && /support|talk/i.test(r.message) && !/fault|should have|cause/i.test(r.message), r?.message);
  check('the companion stays quiet for a while unless she switches it back on', companionToday(s, '2026-04-22', { estimate: estimateNext(s, '2026-04-22') }) === null);
  check('estimates restart from her next periods', estimateNext(s, '2026-05-30').status === 'none');
  P.deletePregnancyRecords(s);
  check('she can delete all pregnancy records', !s.pregnancies?.length && !s.pregnancy && !s.postpartum);
});

run('companion in pregnancy and after birth', () => {
  const s = fresh(); M.setCategory(s, 'nausea', true, { at: AT });
  P.startPregnancy(s, { lmp: '2026-03-02', today: '2026-06-01', at: AT });
  const mon = addDays('2026-03-02', 20 * 7); // exactly 20+0
  const m = companionToday(s, mon, { estimate: estimateNext(s, mon) });
  check('pregnancy: a weekly check-in on the day a new week starts', m?.kind === 'pregnancyWeek' && /20 weeks/.test(m.text) && /Zara/.test(m.text), words(m));
  check('…offering her pregnancy categories (nausea) and Fine', m.quick.some(q => q.id === 'nausea') && m.quick.some(q => q.id === 'fine'), words(m.quick));
  check('…and not on other days', companionToday(s, addDays(mon, 2), { estimate: estimateNext(s, addDays(mon, 2)) }) === null);
  answerCheckIn(s, mon, 'nausea', { severity: 'mild', today: mon, at: AT });
  check('answer saved as she chose it (how strong), marked as from the companion', s.days[mon].nausea === 'mild' && s.days[mon].src.nausea === 'companion');
  P.endPregnancy(s, { outcome: 'birth', date: '2026-11-30', today: '2026-11-30', at: AT });
  const d3 = companionToday(s, '2026-12-03', { estimate: estimateNext(s, '2026-12-03') });
  check('after birth: check-ins on days 3, 7, 10 and 14 (the baby-blues window), then weekly to 12 weeks', d3?.kind === 'postpartum' && ['2026-12-07', '2026-12-10', '2026-12-14', '2026-12-21'].every(d => companionToday(s, d, { estimate: estimateNext(s, d) })?.kind === 'postpartum') && companionToday(s, '2026-12-05', { estimate: estimateNext(s, '2026-12-05') }) === null, words(d3));
  check('the postpartum check-in asks about mood and includes the privacy line', /how are you feeling/i.test(d3.text) && /stay on this phone/i.test(d3.privacy));
  check('no forbidden wording', clean(m) && clean(d3));
});
console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
