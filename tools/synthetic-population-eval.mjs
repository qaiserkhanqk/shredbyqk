// Runs the app's own estimate code over a large SYNTHETIC population (js/cycle/synthpop.js) and checks its rules.
//   node tools/synthetic-population-eval.mjs [participants=1000] [seed=20261126] > docs/synthetic-population-eval.md
// Walk-forward: at each check point the app sees only what she had logged and synced by then (model.stateAsOf).
// Check points per cycle: the day after her period started, and 3 days before the real next start.
import { addDays, diffDays } from '../js/cycle/dates.js';
import { stateAsOf, restartDate } from '../js/cycle/model.js';
import { estimateNext, ALGORITHM_VERSION } from '../js/cycle/predict.js';
import { learningStage } from '../js/cycle/learning.js';
import { adjustedEstimate, lastUsableNight, ADJUST_PARAMS, ADJUST_VERSION } from '../js/cycle/adjust.js';
import { makePopulation, personState, SYNTHPOP_VERSION, SYNTHETIC_BANNER, PARAMS, SOURCES } from '../js/cycle/synthpop.js';

export function evaluatePopulation(n = 1000, seed = 20261126) {
  const people = makePopulation(n, { seed }), rows = [], problems = [];
  const fail = (what, ctx) => { if (problems.length < 50) problems.push(`${what} (${ctx})`); else problems.length++; };
  let nights = 0, evals = 0;
  for (const p of people) {
    const full = personState(p); nights += p.nights.length;
    const starts = p.truth.map(c => c.start);
    for (let k = 0; k + 1 < p.truth.length; k++) {
      const c = p.truth[k]; if (c.pregnancy) continue;
      const next = starts[k + 1];
      for (const [pt, today] of [['day2', addDays(c.start, 1)], ['3daysBefore', addDays(next, -3)]]) {
        if (today <= c.start || today >= next) continue;
        const view = stateAsOf(full, addDays(today, 1), { knownAt: `${today}T23:59:59.999Z` });
        const before = evals % 97 === 0 ? JSON.stringify(view) : null;
        const d = estimateNext(view, today), a = adjustedEstimate(view, today), st = learningStage(view, today); evals++;
        const logged = view.periods.some(x => x.start === c.start); // has she logged this period yet?
        const ctx = `${p.id} ${p.group} ${today}`;
        // Rules the app must keep on every check:
        if (d.rangeStart && st.usableCycles < 1) fail('dates-only gave a date with no completed cycle', ctx);
        if (view.situation?.pregnant && (d.rangeStart || a.status === 'adjusted')) fail('a date during pregnancy', ctx);
        if (a.status === 'adjusted') {
          const last = lastUsableNight(view, today);
          if (!last || diffDays(last, today) - 1 > ADJUST_PARAMS.MAX_MISSING_RECENT_NIGHTS) fail('band adjusted with stale band data', ctx);
          if (view.situation?.postpartum || view.situation?.hormonalContraception) fail('band adjusted in a situation that excludes it', ctx);
          if ((a.intervals || []).length < 2) fail('band adjusted with fewer than 2 past rises', ctx);
          if (a.rangeStart < a.riseNight) fail('band date before the rise', ctx);
          const since = restartDate(view, today); if (since && a.riseNight <= since) fail('band used data from before a pregnancy', ctx);
          if (!p.banded) fail('band adjusted without a band', ctx);
        }
        if (before && JSON.stringify(view) !== before) fail('an estimate changed her data', ctx);
        if (before) { const bare = { ...view, wearable: { devices: [], nights: [] } }; if (JSON.stringify(estimateNext(bare, today)) !== JSON.stringify(d)) fail('dates-only estimate depends on band data', ctx); }
        const typical = d.rangeStart ? addDays(d.lastStart, Math.round(d.median)) : null;
        rows.push({ group: p.group, pt, logged, n: st.usableCycles, dErr: typical ? diffDays(next, typical) : null, dIn: d.rangeStart ? next >= d.rangeStart && next <= d.rangeEnd : null,
          aStatus: a.status, aReason: a.reason || 'adjusted', aErr: a.status === 'adjusted' ? diffDays(next, a.date) : null, aIn: a.status === 'adjusted' ? next >= a.rangeStart && next <= a.rangeEnd : null,
          truthAnov: !!c.anovulatory, truthVisible: !!c.visibleRise });
      }
    }
  }
  return { people, rows, problems, nights, evals };
}

const pct = (a, b) => (b ? `${(100 * a / b).toFixed(1)}%` : '–');
const mae = xs => (xs.length ? (xs.reduce((s, v) => s + Math.abs(v), 0) / xs.length).toFixed(2) : '–');
const within2 = xs => pct(xs.filter(v => Math.abs(v) <= 2).length, xs.length);

function report({ people, rows, problems, nights, evals }, n, seed) {
  const groups = [...new Set(people.map(p => p.group))].sort();
  const line = (label, rs) => {
    const d = rs.filter(r => r.dErr != null), a = rs.filter(r => r.aErr != null), both = a.filter(r => r.dErr != null);
    return `| ${label} | ${rs.length} | ${pct(d.length, rs.length)} | ${mae(d.map(r => r.dErr))} | ${within2(d.map(r => r.dErr))} | ${pct(d.filter(r => r.dIn).length, d.length)} | ${pct(a.length, rs.length)} | ${mae(both.map(r => r.aErr))} vs ${mae(both.map(r => r.dErr))} | ${pct(a.filter(r => r.aIn).length, a.length)} |`;
  };
  const head = '| Group | Checks | Dates-only gave a date | Dates-only average error (days) | Within ±2 days | Real start inside shown range | Band-adjusted used | Band vs dates-only average error, same checks | Real start inside band range |\n|---|---|---|---|---|---|---|---|---|';
  const by3 = rows.filter(r => r.pt === '3daysBefore');
  const reasons = {}; for (const r of by3) reasons[r.aReason] = (reasons[r.aReason] || 0) + 1;
  const cyclesN = people.reduce((s, p) => s + p.truth.filter(c => !c.open && !c.pregnancy).length, 0);
  return `# Synthetic population: stress test of the cycle estimates

**${SYNTHETIC_BANNER}**

- Generator \`${SYNTHPOP_VERSION}\`, seed ${seed}: ${n} synthetic people, ${cyclesN} cycles, ${nights} band nights, ${evals} check points.
- App code under test, unchanged: dates-only \`${ALGORITHM_VERSION}\`; band-adjusted \`${ADJUST_VERSION}\` (research flag, off by default).
- Groups (share is an assumption): ${groups.map(g => `${g} ${people.filter(p => p.group === g).length}`).join(', ')}.

## Rules checked at every check point
${problems.length ? `**${problems.length} problems found:**\n${problems.slice(0, 50).map(x => `- ${x}`).join('\n')}` : `**All passed at all ${evals} check points:**
- no dates-only date before a completed cycle;
- no date during pregnancy;
- band adjustment only with fresh band data, outside pregnancy, postpartum and hormonal contraception, with at least 2 past rises, a date after the rise, and nothing from before a pregnancy;
- never for someone without a band;
- estimates never changed her data;
- the dates-only estimate was identical with or without band data (checked on a sample).`}

## Three days before the real next start
${head}
${groups.map(g => line(g, by3.filter(r => r.group === g))).join('\n')}
${line('**All**', by3)}

## The day after her period started
${head}
${line('**All**', rows.filter(r => r.pt === 'day2' && r.logged))}

This counts only check points where she had already logged the period that day. On ${rows.filter(r => r.pt === 'day2' && !r.logged).length} other check points (${pct(rows.filter(r => r.pt === 'day2' && !r.logged).length, rows.filter(r => r.pt === 'day2').length)}) she had not logged it yet (late or missed logging). The app then still shows the previous, now-overdue estimate and asks her to log, which is the intended behaviour, so those are not counted as errors.

## Why the band-adjusted estimate was not used (three days before)
${Object.entries(reasons).sort((x, y) => y[1] - x[1]).map(([k, v]) => `- ${k}: ${v} (${pct(v, by3.length)})`).join('\n')}

## Generator settings and where they come from
${Object.entries(PARAMS).map(([k, v]) => `- **${k}**: ${JSON.stringify(Object.fromEntries(Object.entries(v).filter(([x]) => x !== 'src')))}. Source: ${v.src}`).join('\n')}

### Sources
${Object.entries(SOURCES).map(([k, v]) => `- **${k}**: ${v.what}. ${v.ref}${v.doi ? ` (https://doi.org/${v.doi})` : v.pmid ? ` (PMID ${v.pmid})` : ''}`).join('\n')}

## What this does and does not show
- **It does show** that the app's rules hold across many kinds of synthetic history:
  - regular, teenage, variable and perimenopausal cycles;
  - pregnancy and return of periods;
  - forgetting the band, band and firmware changes;
  - illness, alcohol and travel nights;
  - late and missed logs.
- **Accuracy figures are not real-world accuracy.** The generator encodes our assumptions about how temperature behaves, so a method built on the same assumptions is expected to do well here. Real accuracy needs real data:
  - the Marquette results for dates only: \`docs/real-data-eval-marquette.md\`;
  - mcPHASES or a prospective study for the band.
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = Number(process.argv[2] || 1000), seed = Number(process.argv[3] || 20261126);
  console.log(report(evaluatePopulation(n, seed), n, seed));
}
