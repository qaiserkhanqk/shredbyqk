// Run the cycle-estimate evaluation harness on the SYNTHETIC cohort.
//   node tools/cycle-eval.mjs                 → markdown report to stdout
//   node tools/cycle-eval.mjs --json out.json → also write the full JSON report
//   node tools/cycle-eval.mjs --participants 80 --seed 7
// Results are synthetic and test the software only. Never report them as real-world accuracy.
import { writeFileSync } from 'node:fs';
import { runEvaluation, toMarkdown } from '../js/cycle/eval.js';
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const t0 = Date.now();
const rep = runEvaluation({ participants: +(arg('--participants') || 40), seed: +(arg('--seed') || 20261114) });
if (arg('--json')) writeFileSync(arg('--json'), JSON.stringify(rep, null, 2));
console.log(toMarkdown(rep));
console.error(`(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
if (!rep.leakageFree) process.exit(1);
