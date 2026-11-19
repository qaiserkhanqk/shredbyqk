// Supplier acceptance test (research/docs/supplier-checklist.md). It runs a supplier's sample files (mapped to the
// documented observation format by the adapter under test) through every checklist item a file can show. It must
// pass good synthetic data, fail each deliberately broken variant on the right item, report what was not tested, and
// never call a device verified or validated beyond the technical checks. Written BEFORE the implementation; the
// failing run is committed in research/docs/test-logs/. Synthetic data only.
// Run: node research/tests/acceptance.test.mjs
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { check, done } from './harness.mjs';
import { participant, OBS_COLUMNS, addDays } from '../lib/synth.js';
import { SwlDs07Adapter } from '../lib/adapters.js';
import * as policy from '../lib/policy.js';

let A = {}; try { A = await import('../lib/acceptance.js'); } catch (e) { check('module lib/acceptance.js exists', false, e.message); }
const run = A.runAcceptance || (() => ({ items: [], verdict: 'missing', blockers: [] }));
const md = A.toMarkdown || (() => '');
const csv = rows => [OBS_COLUMNS.join(','), ...rows.map(r => OBS_COLUMNS.map(c => String(r[c] ?? '')).join(','))].join('\n');
const item = (rep, id) => rep.items?.find(i => i.id === id) || {};
const TOOL = join(dirname(fileURLToPath(import.meta.url)), '..', 'tools', 'supplier-acceptance.mjs');

/* ---------- Synthetic "supplier" sample: 3 people × 12 nights, 5-minute samples ---------- */
const START = '2026-02-02';
const person = (ref, seed, opts = {}) => participant({ ref, seed, start: START, cycleLengths: [12], samplesPerNight: 96, intervalMin: 5, ...opts }).observations;
const ppl = () => {
  const a = person('P-ACC-A', 1, { tzChanges: [{ from: addDays(START, 6), offset: 540 }] }); // travel to UTC+9 on night 7
  const b = person('P-ACC-B', 2).map(r => (r.timestamp_utc >= `${addDays(START, 5)}T12:00:00Z` ? { ...r, firmware: '1.5.0' } : r)); // firmware update before night 6
  const c = person('P-ACC-C', 3);
  return { a, b, c };
};
// Person C took the device off on night 4 between 00:00 and 01:00 UTC; the supplier flags those samples "off_body".
const OFF_FROM = `${addDays(START, 4)}T00:00:00Z`, OFF_TO = `${addDays(START, 4)}T01:00:00Z`;
const inOff = r => r.timestamp_utc >= OFF_FROM && r.timestamp_utc < OFF_TO;
const flagged = rows => rows.map(r => (inOff(r) ? { ...r, source_quality_flags: 'off_body' } : r));
const PROFILE = {
  synthetic: true, device: { manufacturer: 'SyntheticCo', model: 'SYN-1', name: 'Synthetic test device (not a real product)' },
  documentedFlags: ['off_body'], offWristFlags: ['off_body'],
  expect: { firmwareChange: { ref: 'P-ACC-B', night: addDays(START, 5) }, timeZoneChange: { ref: 'P-ACC-A', night: addDays(START, 6), offsetMin: 540 } },
  answers: {},
};
const ALL_ANSWERS = Object.fromEntries(['sensor_specification', 'vendor_processing', 'offline_storage', 'sdk_licence', 'data_ownership_and_cloud', 'platform_route', 'vendor_validation_evidence', 'change_control']
  .map(k => [k, { answer: 'Synthetic answer for the test.', source: 'synthetic test document', reviewedBy: 'test-reviewer', reviewedOn: '2026-03-01' }]));
// Reference-clock pairs: what the device clock showed when a reference clock showed 08:00:00Z (device ahead by deltaS).
const REF_T = Date.parse('2026-02-03T08:00:00Z'), iso = ms => new Date(ms).toISOString().replace('.000Z', 'Z');
const clockCSV = (deltaS = 30) => ['participant_ref,device_serial_pseudonym,device_time_utc,reference_time_utc',
  ...['P-ACC-A', 'P-ACC-B', 'P-ACC-C'].map(ref => `${ref},${ref}-dev1,${iso(REF_T + deltaS * 1000)},${iso(REF_T)}`)].join('\n');
const wearCSV = `participant_ref,removed_at_utc,put_on_at_utc\nP-ACC-C,${OFF_FROM},${OFF_TO}`;
// Bench: a reference thermometer reading during 12 of person C's samples, 0.1 °C above the device.
const benchCSV = rows => ['device_serial_pseudonym,timestamp_utc,reference_c', ...rows.filter(r => !inOff(r)).slice(0, 12).map(r => `${r.device_serial_pseudonym},${new Date(Date.parse(r.timestamp_utc) + 60e3).toISOString()},${(Number(r.value) + 0.1).toFixed(2)}`)].join('\n');
function inputs(over = {}) {
  const { a, b, c } = ppl();
  return {
    profile: { ...PROFILE, answers: ALL_ANSWERS },
    people: [{ ref: 'P-ACC-A', format: 'csv', text: csv(a) }, { ref: 'P-ACC-B', format: 'csv', text: csv(b) }, { ref: 'P-ACC-C', format: 'csv', text: csv(flagged(c)) }],
    resync: { ref: 'P-ACC-C', format: 'csv', text: csv(flagged(c).slice(-300)) }, // interrupted sync: the last ~3 nights sent again
    clock: clockCSV(30), wear: wearCSV, bench: benchCSV(flagged(c)),
    ...over,
  };
}

/* ---------- 1. Good synthetic sample ---------- */
const good = run(inputs());
const AUTOMATED = ['files_parse_cleanly', 'identity_on_every_record', 'utc_offset_on_every_record', 'sampling_interval_declared', 'quality_flags_documented', 'nights_and_quality',
  'clock_within_2_minutes', 'off_wrist_flagged', 'firmware_change_detected', 'time_zone_change_reflected', 'units_confirmed_against_bench', 'resync_no_duplicates'];
check('good: every automated checklist item passes', AUTOMATED.every(id => item(good, id).status === 'pass'), AUTOMATED.filter(id => item(good, id).status !== 'pass').map(id => `${id}=${item(good, id).status}:${item(good, id).detail}`).join(' | '));
check('good: with every supplier answer reviewed, the verdict is "technically_verified"', good.verdict === 'technically_verified', `${good.verdict} ${JSON.stringify(good.blockers)}`);
check('good: the report says it is technical only (not accuracy, clinical use or ovulation)', /technical/i.test(good.disclaimer || '') && /not.*(accura|clinical)/i.test(good.disclaimer || '') && /ovulation/i.test(good.disclaimer || ''));
check('good: a synthetic sample is labelled as synthetic', good.synthetic === true && /synthetic/i.test(md(good).split('\n').slice(0, 6).join(' ')));
check('good: the nights item reports per person and the quality share with its denominator', /P-ACC-A/.test(JSON.stringify(item(good, 'nights_and_quality').evidence || {})) && Number.isFinite(item(good, 'nights_and_quality').evidence?.wornNights));
check('good: the bench item reports the difference for review and applies no invented tolerance', Number.isFinite(item(good, 'units_confirmed_against_bench').evidence?.medianAbsDiffC) && item(good, 'units_confirmed_against_bench').evidence?.matchedPairs >= 10);
check('good: the report passes the output policy (no forbidden wording)', (() => { try { policy.checkValue(good); policy.checkText(md(good)); return true; } catch (e) { return false; } })());
check('good: the report never claims the device "works" or is "validated"', !/\b(device|it)\s+works\b|\bclinically validated\b|\bvalidated device\b/i.test(md(good).replace(/not .{0,40}validated/gi, '')));
check('good: the SWL DS07 adapter is still a stub (passing a sample changes nothing)', SwlDs07Adapter().verified === false);

/* ---------- 2. Supplier answers missing or unreviewed ---------- */
const noAnswers = run(inputs({ profile: { ...PROFILE, answers: {} } }));
check('answers: without written answers the verdict is "not_verified" and lists them', noAnswers.verdict === 'not_verified' && noAnswers.items.filter(i => i.kind === 'manual').every(i => i.status === 'needs_written_answer') && noAnswers.blockers.includes('sdk_licence'));
const unreviewed = run(inputs({ profile: { ...PROFILE, answers: Object.fromEntries(Object.entries(ALL_ANSWERS).map(([k, v]) => [k, { answer: v.answer, source: v.source }])) } }));
check('answers: a supplier answer that we have not reviewed is "supplier_answered", not verified', unreviewed.verdict === 'not_verified' && item(unreviewed, 'sdk_licence').status === 'supplier_answered');

/* ---------- 3. Each broken variant fails on its own item ---------- */
const failsOn = (label, over, id, extra = () => true) => { const r = run(inputs(over)); check(`fail: ${label} → ${id} fails and the verdict is not_verified`, item(r, id).status === 'fail' && r.verdict === 'not_verified' && extra(r), `${item(r, id).status}: ${item(r, id).detail}`); return r; };
{
  const { a, b, c } = ppl();
  failsOn('a row with an impossible timestamp', { people: [{ ref: 'P-ACC-A', format: 'csv', text: csv([...a.slice(0, -1), { ...a.at(-1), timestamp_utc: '2026-02-30T01:00:00Z' }]) }, ...inputs().people.slice(1)] }, 'files_parse_cleanly');
  failsOn('firmware missing on some records', { people: [{ ref: 'P-ACC-A', format: 'csv', text: csv(a.map((r, i) => (i % 50 === 0 ? { ...r, firmware: '' } : r))) }, ...inputs().people.slice(1)] }, 'identity_on_every_record');
  failsOn('no sampling interval and no end time', { people: [{ ref: 'P-ACC-A', format: 'csv', text: csv(a.map(r => ({ ...r, sampling_interval_s: '', end_timestamp_utc: '' }))) }, ...inputs().people.slice(1)] }, 'sampling_interval_declared');
  failsOn('an undocumented quality flag', { people: [...inputs().people.slice(0, 2), { ref: 'P-ACC-C', format: 'csv', text: csv(flagged(c).map((r, i) => (i === 10 ? { ...r, source_quality_flags: 'charging' } : r))) }] }, 'quality_flags_documented', r => /charging/.test(item(r, 'quality_flags_documented').detail));
  failsOn('only two people with 10 consecutive nights', { people: [...inputs().people.slice(0, 2), { ref: 'P-ACC-C', format: 'csv', text: csv(flagged(c).filter(r => r.timestamp_utc < `${addDays(START, 6)}T12:00:00Z`)) }], resync: null }, 'nights_and_quality');
  failsOn('a reference-clock pair 3 minutes apart', { clock: clockCSV(180) }, 'clock_within_2_minutes');
  failsOn('off-wrist samples not flagged', { people: [...inputs().people.slice(0, 2), { ref: 'P-ACC-C', format: 'csv', text: csv(c) }], resync: { ref: 'P-ACC-C', format: 'csv', text: csv(c.slice(-300)) }, bench: benchCSV(c) }, 'off_wrist_flagged');
  failsOn('the expected firmware change does not show in the data', { people: [inputs().people[0], { ref: 'P-ACC-B', format: 'csv', text: csv(person('P-ACC-B', 2)) }, inputs().people[2]] }, 'firmware_change_detected');
  failsOn('offsets not updated after travel', { people: [{ ref: 'P-ACC-A', format: 'csv', text: csv(person('P-ACC-A', 1)) }, ...inputs().people.slice(1)] }, 'time_zone_change_reflected');
  failsOn('a re-sync that changes stored values', { resync: { ref: 'P-ACC-C', format: 'csv', text: csv(flagged(c).slice(-300).map((r, i) => (i === 5 ? { ...r, value: (Number(r.value) + 0.5).toFixed(2) } : r))) } }, 'resync_no_duplicates');
  // Unit check: the device file says °F, and the values are °F; the bench reference is °C. Declared unit fits → pass.
  const cf = flagged(c).map(r => ({ ...r, unit: 'F', value: (Number(r.value) * 1.8 + 32).toFixed(2) }));
  const rf = run(inputs({ people: [...inputs().people.slice(0, 2), { ref: 'P-ACC-C', format: 'csv', text: csv(cf) }], resync: { ref: 'P-ACC-C', format: 'csv', text: csv(cf.slice(-300)) }, bench: benchCSV(flagged(c)) }));
  check('units: correctly declared °F values agree with a °C bench reference after conversion', item(rf, 'units_confirmed_against_bench').status === 'pass', item(rf, 'units_confirmed_against_bench').detail);
  // The device says °C but the bench shows its numbers are really °F-scale offsets of the reference: fail.
  const wrong = ['device_serial_pseudonym,timestamp_utc,reference_c', ...flagged(c).filter(r => !inOff(r)).slice(0, 12).map(r => `${r.device_serial_pseudonym},${new Date(Date.parse(r.timestamp_utc) + 60e3).toISOString()},${((Number(r.value) - 32) / 1.8).toFixed(2)}`)].join('\n');
  failsOn('the bench reference matches the other unit better than the declared one', { bench: wrong }, 'units_confirmed_against_bench');
}

/* ---------- 4. Missing evidence is "not tested", never a pass ---------- */
{
  const r = run(inputs({ clock: null, wear: null, bench: null, resync: null, profile: { ...PROFILE, answers: ALL_ANSWERS, expect: {} } }));
  const nt = ['clock_within_2_minutes', 'off_wrist_flagged', 'units_confirmed_against_bench', 'resync_no_duplicates', 'firmware_change_detected', 'time_zone_change_reflected'];
  check('not tested: items without their evidence are "not_tested", and the verdict is not_verified', nt.every(id => item(r, id).status === 'not_tested') && r.verdict === 'not_verified', nt.map(id => `${id}=${item(r, id).status}`).join(','));
  const ov = run(inputs({ resync: { ref: 'P-ACC-C', format: 'csv', text: csv(person('P-ACC-C', 99, { start: '2026-05-01' }).map(x => ({ ...x }))) } }));
  check('not tested: a re-sync export that shares no rows with the first export did not test de-duplication', item(ov, 'resync_no_duplicates').status === 'not_tested', item(ov, 'resync_no_duplicates').detail);
}

/* ---------- 5. Command-line tool ---------- */
{
  const dir = mkdtempSync(join(tmpdir(), 'rs-acc-')), I = inputs();
  const f = n => join(dir, n);
  writeFileSync(f('profile.json'), JSON.stringify(I.profile)); I.people.forEach(p => writeFileSync(f(`${p.ref}.csv`), p.text));
  writeFileSync(f('resync.csv'), I.resync.text); writeFileSync(f('clock.csv'), I.clock); writeFileSync(f('wear.csv'), I.wear); writeFileSync(f('bench.csv'), I.bench);
  const args = ['--profile', f('profile.json'), ...I.people.flatMap(p => ['--observations', `${p.ref}=${f(`${p.ref}.csv`)}`]), '--resync', `P-ACC-C=${f('resync.csv')}`, '--clock', f('clock.csv'), '--wear', f('wear.csv'), '--bench', f('bench.csv'), '--out', f('report.md'), '--json', f('report.json')];
  const ok = spawnSync(process.execPath, ['--no-warnings', TOOL, ...args], { encoding: 'utf8' });
  check('cli: a passing sample exits 0 and writes the Markdown and JSON reports', ok.status === 0 && existsSync(f('report.md')) && existsSync(f('report.json')) && JSON.parse(readFileSync(f('report.json'), 'utf8')).verdict === 'technically_verified', (ok.stderr || ok.stdout).slice(0, 300));
  const bad = spawnSync(process.execPath, ['--no-warnings', TOOL, ...args.filter((x, i, a) => !(x === '--clock' || a[i - 1] === '--clock'))], { encoding: 'utf8' });
  check('cli: an incomplete sample exits 1 (not verified)', bad.status === 1, String(bad.status));
  const usage = spawnSync(process.execPath, ['--no-warnings', TOOL], { encoding: 'utf8' });
  check('cli: missing arguments exit 2 with usage', usage.status === 2);
  check('cli: the Markdown report shows every checklist item with its status', existsSync(f('report.md')) && AUTOMATED.every(id => readFileSync(f('report.md'), 'utf8').includes(id)));
}
done();
