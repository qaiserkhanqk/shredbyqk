// Head-to-head comparison of alternative DATES-ONLY designs on the Marquette real cycle data (Fehring 2012).
//   node tools/compare-designs.mjs "path/to/FedCycleData071012 (2).csv" > docs/design-comparison-marquette.md
// Method, fixed before looking at test results:
//   • Participants are split by a hash of their ID: ~30% DEVELOPMENT (used only to tune settings and choose ranges),
//     ~70% TEST (used only to score). Nothing is tuned on the test group.
//   • Walk-forward: each prediction uses only that woman's earlier cycles; at least 1 completed cycle is required, as
//     in the app.
//   • Point designs are scored by average absolute error (days) and % within ±2 days; range designs by how often the
//     real start falls inside (coverage) and the average width. Differences from the current design get a 95%
//     participant-level bootstrap interval.
//   • D0 + R_app must reproduce the app's own estimate (js/cycle/predict.js) exactly; the tool stops if they don't.
//     Since dates-only-2.0.0 the app shows the calibrated range (fixed settings); R0 is the previous app range.
// Real data, aggregate output only. Not clinical validation; one population; dates only (no band data).
import * as M from '../js/cycle/model.js';
import { addDays, diffDays } from '../js/cycle/dates.js';
import { estimateNext, PARAMS, RANGE as APP_RANGE, rangeHalfWidth } from '../js/cycle/predict.js';
import { loadMarquette } from './lib/marquette.mjs';

const file = process.argv[2];
if (!file) { console.error('usage: node tools/compare-designs.mjs <FedCycleData csv>'); process.exit(2); }
const { series, truncated } = loadMarquette(file);

const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const isDev = id => hash(`split-2026-11-26:${id}`) % 10 < 3;
const median = xs => { const a = [...xs].sort((x, y) => x - y), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = xs => (xs.length > 1 ? Math.sqrt(xs.reduce((a, v) => a + (v - mean(xs)) ** 2, 0) / (xs.length - 1)) : 0);
const RECENT = PARAMS.RECENT;

// Every prediction point: her past lengths (oldest first) and the true next length.
const points = [];
for (const { id, lens } of series) for (let k = 1; k < lens.length; k++) points.push({ id, dev: isDev(id), past: lens.slice(0, k), truth: lens[k] });
const dev = points.filter(p => p.dev), test = points.filter(p => !p.dev);

// Population figures, from the DEVELOPMENT group only.
const devLens = series.filter(s => isDev(s.id)).flatMap(s => s.lens);
const POP_MEAN = mean(devLens);
const POP_SD_WITHIN = Math.sqrt(mean(series.filter(s => isDev(s.id) && s.lens.length > 2).map(s => sd(s.lens) ** 2)));

/** Point designs: past lengths → predicted next length (days). */
const POINT = {
  D0_current_median_last6: past => median(past.slice(-RECENT)),
  D1_mean_last6: past => mean(past.slice(-RECENT)),
  D2_median_last3: past => median(past.slice(-3)),
  D3_median_all_history: past => median(past),
  D4_recency_weighted: (past, w = 0.75) => { const r = past.slice(-RECENT), ws = r.map((_, i) => w ** (r.length - 1 - i)); return r.reduce((a, v, i) => a + v * ws[i], 0) / ws.reduce((a, b) => a + b, 0); },
  D5_shrink_to_population: (past, k = 2) => { const n = Math.min(past.length, RECENT); return (n * median(past.slice(-RECENT)) + k * POP_MEAN) / (n + k); },
};
// Tune D4's weight and D5's k on DEVELOPMENT only.
const maeOf = (pts, f) => mean(pts.map(p => Math.abs(p.truth - Math.round(f(p.past)))));
const tuned = {
  D4: [0.5, 0.65, 0.75, 0.9].reduce((b, w) => (maeOf(dev, p => POINT.D4_recency_weighted(p, w)) < maeOf(dev, p => POINT.D4_recency_weighted(p, b)) ? w : b), 0.75),
  D5: [0.5, 1, 2, 4].reduce((b, k) => (maeOf(dev, p => POINT.D5_shrink_to_population(p, k)) < maeOf(dev, p => POINT.D5_shrink_to_population(p, b)) ? k : b), 2),
};
const designs = { ...POINT, D4_recency_weighted: p => POINT.D4_recency_weighted(p, tuned.D4), D5_shrink_to_population: p => POINT.D5_shrink_to_population(p, tuned.D5) };

/** Range designs: past → [lo, hi] in cycle-length days. R1's multiplier is set on DEVELOPMENT for 80% coverage. */
const r1Half = (past, z) => { const r = past.slice(-RECENT), n = r.length, k = 3; const s = Math.sqrt(((n - 1) * sd(r) ** 2 + k * POP_SD_WITHIN ** 2) / (n - 1 + k)); return z * s; };
const RANGE = {
  R0_previous_app_shortest_to_longest: past => [Math.min(...past.slice(-RECENT)), Math.max(...past.slice(-RECENT))],
  R_app_calibrated_fixed: past => { const r = past.slice(-RECENT), c = median(r), h = rangeHalfWidth(r); return [Math.round(c - h), Math.round(c + h)]; },
  R1_calibrated_80: (past, z) => { const c = median(past.slice(-RECENT)), h = r1Half(past, z); return [Math.round(c - h), Math.round(c + h)]; },
};
const cover = (pts, f) => mean(pts.map(p => { const [lo, hi] = f(p.past); return p.truth >= lo && p.truth <= hi ? 1 : 0; }));
let z80 = 0.5; for (let z = 0.5; z <= 3; z += 0.05) { z80 = z; if (cover(dev, p => RANGE.R1_calibrated_80(p, z)) >= 0.80) break; }
const ranges = { ...RANGE, R1_calibrated_80: p => RANGE.R1_calibrated_80(p, z80) };

// D0 must equal the app: compare on every test point. Points where the app gives no date (cycles too variable) are
// left out for every design, so all designs are scored on exactly the same points.
let mismatches = 0, abstained = 0;
for (const p of [...test, ...dev]) {
  const s = M.blankState('cmp'); M.giveConsent(s, '2020-01-01T00:00:00.000Z');
  const starts = ['2020-01-06']; for (const l of p.past) starts.push(addDays(starts.at(-1), l));
  for (const st of starts) M.logPeriodStart(s, st, { today: addDays(starts.at(-1), 1), at: '2020-01-01T00:00:00.000Z' });
  const e = estimateNext(s, addDays(starts.at(-1), 1));
  if (!e.rangeStart) { p.appAbstains = true; if (!p.dev) abstained++; continue; }
  const lo = diffDays(e.lastStart, e.rangeStart), hi = diffDays(e.lastStart, e.rangeEnd);
  const [alo, ahi] = ranges.R_app_calibrated_fixed(p.past);
  if (e.median !== designs.D0_current_median_last6(p.past) || lo !== alo || hi !== ahi) mismatches++;
}
if (mismatches) { console.error(`D0 does not reproduce the app on ${mismatches} points; stopping.`); process.exit(1); }
for (const arr of [dev, test]) for (let i = arr.length - 1; i >= 0; i--) if (arr[i].appAbstains) arr.splice(i, 1);

// Scoring on TEST, with participant-level bootstrap for differences vs D0.
const groups = [['1 past cycle', p => p.past.length === 1], ['2', p => p.past.length === 2], ['3–5', p => p.past.length >= 3 && p.past.length <= 5], ['6+', p => p.past.length >= 6], ['All', () => true]];
const err = (p, f) => Math.abs(p.truth - Math.round(f(p.past)));
const ids = [...new Set(test.map(p => p.id))], byId = new Map(ids.map(id => [id, test.filter(p => p.id === id)]));
function bootDiff(f, g, B = 2000) {
  let seed = 12345; const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  const out = [];
  for (let b = 0; b < B; b++) { let s = 0, n = 0; for (let i = 0; i < ids.length; i++) for (const p of byId.get(ids[Math.floor(rnd() * ids.length)])) { s += err(p, f) - err(p, g); n++; } out.push(s / n); }
  out.sort((x, y) => x - y); return [out[Math.floor(0.025 * B)], out[Math.floor(0.975 * B)]];
}
const f2 = x => x.toFixed(2), pc = x => `${(100 * x).toFixed(1)}%`;
const pointRows = Object.entries(designs).map(([name, f]) => {
  const cells = groups.map(([, g]) => { const pts = test.filter(g); return f2(mean(pts.map(p => err(p, f)))); });
  const w2 = pc(mean(test.map(p => (err(p, f) <= 2 ? 1 : 0))));
  const [lo, hi] = name === 'D0_current_median_last6' ? [0, 0] : bootDiff(f, designs.D0_current_median_last6);
  const verdict = name === 'D0_current_median_last6' ? 'reference' : hi < 0 ? '**better** (interval below 0)' : lo > 0 ? 'worse' : 'no clear difference';
  return `| ${name} | ${cells.join(' | ')} | ${w2} | ${name === 'D0_current_median_last6' ? '–' : `${f2(lo)} to ${f2(hi)}`} | ${verdict} |`;
});
const rangeRows = Object.entries(ranges).map(([name, f]) => {
  const cells = groups.map(([, g]) => { const pts = test.filter(g); return `${pc(cover(pts, f))} / ${f2(mean(pts.map(p => { const [lo, hi] = f(p.past); return hi - lo + 1; })))} d`; });
  return `| ${name} | ${cells.join(' | ')} |`;
});

console.log(`# Alternative period-estimate designs compared on real data (Marquette)

**Real, anonymised cycle lengths (Fehring 2012). A comparison of software designs on one population; not clinical
validation; dates only (no band data).**

- ${series.length} participants (${truncated} sequences stopped at a gap or repeated cycle number). Split by ID hash:
  development ${new Set(dev.map(p => p.id)).size} participants / ${dev.length} predictions (tuning only), test ${ids.length} participants / ${test.length} predictions (scoring only).
- The current app (D0 date + R_app range, settings z ${APP_RANGE.Z}, population spread ${APP_RANGE.POP_SD}) was checked against the app's own code on every point: identical. The app gave no date on ${abstained} test points (cycles too variable); those are left out for every design.
- Settings tuned on development only: D4 recency weight = ${tuned.D4}; D5 strength = ${tuned.D5} (population mean ${POP_MEAN.toFixed(2)} days from development); R1 multiplier = ${z80.toFixed(2)} (80% coverage on development; population within-person SD ${POP_SD_WITHIN.toFixed(2)} days).

## Point estimate: average error in days on the TEST group (lower is better)
| Design | 1 past cycle | 2 | 3–5 | 6+ | All | Within ±2 days (all) | Difference vs current, 95% interval | Verdict |
|---|---|---|---|---|---|---|---|---|
${pointRows.join('\n')}

## Range shown to her: coverage / average width on the TEST group
| Design | 1 past cycle | 2 | 3–5 | 6+ | All |
|---|---|---|---|---|---|
${rangeRows.join('\n')}

## Designs
- **D0 (current app):** median of her last ${RECENT} cycles.
- **D1:** mean of her last ${RECENT}.
- **D2:** median of her last 3.
- **D3:** median of her whole history.
- **D4:** recency-weighted mean of her last ${RECENT}; the most recent cycle counts most.
- **D5:** her median pulled towards the population average when she has few cycles. **This uses a population number, which the app deliberately does not do today.** Adopting it would be a product decision.
- **R0 (previous app, before dates-only-2.0.0):** shortest to longest of her last ${RECENT} cycles.
- **R_app (current app):** the calibrated range with the settings fixed in the app (z ${APP_RANGE.Z}, population spread ${APP_RANGE.POP_SD} days, worth ${APP_RANGE.PRIOR_CYCLES} cycles).
- **R1:** a range around her median whose width comes from her own spread, steadied by the population's spread when she has few cycles, set for about 80% coverage. It also uses a population number.
`);
