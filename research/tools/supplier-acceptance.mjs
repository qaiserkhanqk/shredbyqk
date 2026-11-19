// Supplier acceptance test: run a supplier's sample files through research/docs/supplier-checklist.md.
// Nothing is stored or sent anywhere; the files are read, checked and a report is written.
//
//   node research/tools/supplier-acceptance.mjs --profile profile.json \
//     --observations P-001=p001.csv --observations P-002=p002.csv --observations P-003=p003.csv \
//     [--resync P-001=p001-resync.csv] [--clock clock.csv] [--wear wear.csv] [--bench bench.csv] \
//     [--out report.md] [--json report.json]
//
// Files are in the documented observation format (research/docs/data-dictionary.md): the output of the adapter under
// test. Evidence files are CSV:
//   clock: participant_ref, device_serial_pseudonym, device_time_utc, reference_time_utc
//   wear:  participant_ref, removed_at_utc, put_on_at_utc
//   bench: device_serial_pseudonym, timestamp_utc, reference_c
// Exit code: 0 = technically verified, 1 = not verified, 2 = usage error.
// Example (synthetic): research/fixtures/acceptance-synthetic/README.md
import { readFileSync, writeFileSync } from 'node:fs';
import { runAcceptance, toMarkdown } from '../lib/acceptance.js';

const argv = process.argv.slice(2), all = k => argv.flatMap((a, i) => (a === `--${k}` ? [argv[i + 1]] : [])), one = k => all(k)[0];
const usage = () => { console.error('usage: supplier-acceptance.mjs --profile FILE --observations REF=FILE [--observations …] [--resync REF=FILE] [--clock FILE] [--wear FILE] [--bench FILE] [--out FILE.md] [--json FILE.json]'); process.exit(2); };
if (!one('profile') || !all('observations').length) usage();
const read = f => readFileSync(f, 'utf8');
const pair = s => { const i = String(s).indexOf('='); if (i < 1) usage(); const ref = s.slice(0, i), file = s.slice(i + 1); return { ref, format: /\.json$/i.test(file) ? 'json' : 'csv', text: read(file) }; };
let profile; try { profile = JSON.parse(read(one('profile'))); } catch (e) { console.error(`Profile: ${e.message}`); process.exit(2); }
const report = runAcceptance({
  profile, people: all('observations').map(pair), resync: one('resync') ? pair(one('resync')) : null,
  clock: one('clock') ? read(one('clock')) : null, wear: one('wear') ? read(one('wear')) : null, bench: one('bench') ? read(one('bench')) : null,
});
const markdown = toMarkdown(report);
if (one('out')) writeFileSync(one('out'), markdown); else process.stdout.write(markdown);
if (one('json')) writeFileSync(one('json'), JSON.stringify(report, null, 2) + '\n');
const counts = report.items.reduce((m, i) => ((m[i.status] = (m[i.status] || 0) + 1), m), {});
console.error(`${report.verdict === 'technically_verified' ? 'Technically verified (files only)' : 'Not verified'}: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}.${report.synthetic ? ' SYNTHETIC SAMPLE.' : ''}`);
process.exit(report.verdict === 'technically_verified' ? 0 : 1);
