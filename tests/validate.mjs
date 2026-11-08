// Accuracy validation against a reference system (lab motion capture, force plate, jump mat, linear encoder).
//
// Usage:  node tests/validate.mjs results.csv
// CSV columns: subject,metric,app,reference   (one row per trial; header row required)
//   e.g.  S01,knee_angle_min,84.2,86.0
//         S01,jump_height_cm,38.1,39.0
//
// Reports per metric the standard agreement statistics used in biomechanics validation papers:
//   n, bias (mean app − reference), MAE, RMSE, 95% limits of agreement (Bland & Altman 1986),
//   Pearson r, and ICC(2,1) absolute agreement (Shrout & Fleiss 1979; Koo & Li 2016 bands).
import fs from 'node:fs';

export function agreement(app, ref) {
  const n = app.length, d = app.map((a, i) => a - ref[i]);
  const mean = x => x.reduce((s, v) => s + v, 0) / x.length;
  const bias = mean(d), sdD = Math.sqrt(d.reduce((s, v) => s + (v - bias) ** 2, 0) / (n - 1));
  const mae = mean(d.map(Math.abs)), rmse = Math.sqrt(mean(d.map(v => v * v)));
  const ma = mean(app), mr = mean(ref);
  let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (app[i] - ma) * (ref[i] - mr); sxx += (app[i] - ma) ** 2; syy += (ref[i] - mr) ** 2; }
  const r = sxy / Math.sqrt(sxx * syy);
  // ICC(2,1): two-way random effects, absolute agreement, single measurement. k = 2 "raters" (app, reference).
  const k = 2, grand = (ma + mr) / 2, rowMeans = app.map((a, i) => (a + ref[i]) / 2);
  const SSR = k * rowMeans.reduce((s, m) => s + (m - grand) ** 2, 0);
  const SSC = n * ((ma - grand) ** 2 + (mr - grand) ** 2);
  const SST = [...app, ...ref].reduce((s, v) => s + (v - grand) ** 2, 0);
  const SSE = SST - SSR - SSC;
  const MSR = SSR / (n - 1), MSC = SSC / (k - 1), MSE = SSE / ((n - 1) * (k - 1));
  const icc = (MSR - MSE) / (MSR + (k - 1) * MSE + (k * (MSC - MSE)) / n);
  const band = icc >= 0.9 ? 'excellent' : icc >= 0.75 ? 'good' : icc >= 0.5 ? 'moderate' : 'poor';
  return { n, bias, mae, rmse, loaLow: bias - 1.96 * sdD, loaHigh: bias + 1.96 * sdD, r, icc, band };
}

if (process.argv[1] && process.argv[1].endsWith('validate.mjs') && process.argv[2]) {
  const rows = fs.readFileSync(process.argv[2], 'utf8').trim().split(/\r?\n/).slice(1).map(l => l.split(','));
  const by = {};
  for (const [, metric, a, r] of rows) (by[metric] ||= { app: [], ref: [] }).app.push(+a), by[metric].ref.push(+r);
  const out = Object.entries(by).map(([metric, { app, ref }]) => {
    const s = agreement(app, ref), f = v => v.toFixed(2);
    return { metric, n: s.n, bias: f(s.bias), MAE: f(s.mae), RMSE: f(s.rmse), 'LoA 95%': `${f(s.loaLow)} to ${f(s.loaHigh)}`, r: f(s.r), ICC: `${f(s.icc)} (${s.band})` };
  });
  console.table(out);
}
