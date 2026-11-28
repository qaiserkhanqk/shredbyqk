// QK's weekly food report: what went well, and one or two small things to ADD next week.
//
// Tone rules (tested in tests/weekly.test.mjs): lead with wins; at most two focus points; every focus
// is something to add or swap, never something to feel bad about; no "bad", "fail", "poor",
// "deficient" or "too much". Nutrient advice is food first. Supplements and tests are only ever
// "worth asking your doctor about".
//
// Inputs come from what the app already has: the food log, water taps, weigh-ins, training sessions,
// the training plan, the profile (targets) and whether the person is in rehab.
import { targets, dietGoal, ingredientsOf, GROUP_OF, MILK_EQ, DISH, estimate } from './nutrition.js';
import { avgSteps, activityFromSteps } from './activity.js';

const DAY = 864e5;
const FRIED_FAST = /zinger|chicken_burger|fried_chicken|broast|nuggets|fries|bun_kebab|anda_shami|samosa_chaat|gol_gappay/;
export const dayKey = t => { const x = new Date(t); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const r0 = Math.round, fmt = v => r0(v).toLocaleString('en');

/** Water target in 250 ml glasses: ~35 ml per kg, plus two glasses on training days (EFSA 2010 adequate intakes are 2.0–2.5 L/day from drinks and food). */
export function waterGoal(kg, trained = false) {
  const base = kg > 30 ? Math.round(kg * 35 / 250) : 8;
  return Math.min(16, Math.max(8, base)) + (trained ? 2 : 0);
}

/** Weight trend in kg/week from weigh-ins (least squares), or null with too little data. */
export function weightTrend(points, now = Date.now(), days = 28) {
  const p = points.filter(x => x.kg > 0 && x.at > now - days * DAY && x.at <= now).sort((a, b) => a.at - b.at);
  if (p.length < 2 || p[p.length - 1].at - p[0].at < 6 * DAY) return null;
  const xs = p.map(x => x.at / (7 * DAY)), ys = p.map(x => x.kg);
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  return { perWeek: slope, latest: p[p.length - 1].kg, n: p.length, spanDays: (p[p.length - 1].at - p[0].at) / DAY };
}

/** Sum one day's log into totals and food groups. */
export function dayStats(entries) {
  const s = { kcal: 0, protein: 0, fibre: 0, veg: 0, fruit: 0, dairy: 0, legumes: 0, fish: 0, redMeat: 0, poultry: 0, egg: 0, fried: 0, sweet: 0, outKcal: 0, unknownKcal: 0, meals: new Set() };
  for (const e of entries) {
    s.kcal += e.kcal; s.protein += e.protein; s.meals.add(e.meal);
    const est = estimate(e.ref, e.opts || {}); s.fibre += est.fibre || 0;
    const d = e.ref.t === 'dish' ? DISH[e.ref.id] : null;
    const sweet = d?.kind === 'sweet' || /jamun|jalebi|cola|milkshake/.test(d?.id || '');
    if (sweet) s.sweet++;
    else if (d?.kind === 'fried' || FRIED_FAST.test(d?.id || '')) s.fried++;
    if (e.opts?.style === 'restaurant' || e.opts?.style === 'shaadi') s.outKcal += e.kcal;
    const ings = ingredientsOf(e.ref, e.opts || {});
    if (!ings) { s.unknownKcal += e.kcal; continue; }
    for (const [ing, g] of ings) {
      const grp = GROUP_OF[ing];
      if (grp === 'veg') s.veg += g; else if (grp === 'fruit') s.fruit += g;
      else if (grp === 'dairy') s.dairy += g * (MILK_EQ[ing] || 1);
      else if (grp && grp in s) s[grp] += g;
    }
  }
  return s;
}

/**
 * The report for the 7 days ending on `now`.
 * @param o { log, water: {dayKey: glasses}, weights: [{at, kg}], sessions: [{at}], profile, rehab: bool, now }
 */
export function weekReport(o) {
  const now = o.now ?? Date.now(), p = o.profile || {}, t = targets(p), goal = dietGoal(p);
  const keys = Array.from({ length: 7 }, (_, i) => dayKey(now - (6 - i) * DAY));
  const byDay = Object.fromEntries(keys.map(k => [k, []]));
  for (const e of o.log || []) { const k = dayKey(e.at); if (byDay[k]) byDay[k].push(e); }
  const trainDays = new Set((o.sessions || []).filter(s => !s.demo).map(s => dayKey(s.at)).filter(k => byDay[k]));

  // A day counts once it looks fully logged; half-logged days would make every average look low.
  // Two or more meals logged counts even when the total is low, so real under-eating still shows up.
  const target = t ? t.kcal : 2000;
  // Days the client marked "I didn't log everything" never count: a half-logged day isn't a low-calorie day.
  const full = keys.filter(k => !o.incomplete?.[k]).filter(k => {
    const kc = byDay[k].reduce((a, e) => a + e.kcal, 0), meals = new Set(byDay[k].map(e => e.meal)).size;
    return kc >= target * 0.45 || (meals >= 2 && kc >= target * 0.25);
  });
  const stats = full.map(k => ({ k, trained: trainDays.has(k), ...dayStats(byDay[k]) }));
  const n = stats.length, avg = f => (n ? stats.reduce((a, s) => a + f(s), 0) / n : 0);
  const kg = +p.weightKg || 0;
  const waterDays = keys.filter(k => (o.water?.[k] || 0) > 0);
  const waterAvg = waterDays.length ? waterDays.reduce((a, k) => a + o.water[k], 0) / waterDays.length : null;
  const waterOk = waterDays.filter(k => o.water[k] >= waterGoal(kg, trainDays.has(k))).length;
  const A = {
    kcal: avg(s => s.kcal), protein: avg(s => s.protein), fibre: avg(s => s.fibre), veg: avg(s => s.veg), fruit: avg(s => s.fruit),
    vegFruit: avg(s => s.veg + s.fruit), dairy: avg(s => s.dairy),
    proteinTrain: stats.filter(s => s.trained).length ? stats.filter(s => s.trained).reduce((a, s) => a + s.protein, 0) / stats.filter(s => s.trained).length : null,
    outShare: avg(s => s.outKcal) / Math.max(1, avg(s => s.kcal)), unknownShare: avg(s => s.unknownKcal) / Math.max(1, avg(s => s.kcal)),
  };
  const week = {
    fishDays: stats.filter(s => s.fish > 0).length, legumeDays: stats.filter(s => s.legumes > 0).length,
    meatDays: stats.filter(s => s.redMeat + s.poultry + s.fish > 0).length, eggDays: stats.filter(s => s.egg > 0).length,
    fried: stats.reduce((a, s) => a + s.fried, 0), sweet: stats.reduce((a, s) => a + s.sweet, 0),
    proteinDays: t ? stats.filter(s => s.protein >= t.protein * 0.9).length : 0,
    fruitDays: stats.filter(s => s.fruit >= 80).length,
  };
  const trend = weightTrend(o.weights || [], now);
  const steps = avgSteps(o.steps || {}, keys);
  const report = { days: keys, logged: n, trained: trainDays.size, avg: A, week, target: t, goal, trend, water: { avg: waterAvg, okDays: waterOk, goal: waterGoal(kg) }, steps, wins: [], focus: [], notes: [], enough: n >= 3 };
  if (!report.enough) {
    report.line = n ? `${n} full day${n > 1 ? 's' : ''} logged so far. Snap your meals for a few more days and QK will read your week.` : 'Snap your meals this week and QK will read your week for you.';
    return report;
  }

  /* ---------- Wins (the report always opens with these) ---------- */
  const W = report.wins;
  if (n >= 5) W.push(`You logged ${n} of 7 days. That's what makes these numbers worth trusting.`);
  if (t && A.protein >= t.protein * 0.9) W.push(`Protein averaged ${fmt(A.protein)} g a day: right on target for building and keeping muscle.`);
  else if (t && week.proteinDays >= 3) W.push(`You hit your protein on ${week.proteinDays} days.`);
  if (trainDays.size >= 3) W.push(`${trainDays.size} training days this week. Your food is fuelling real work.`);
  if (A.vegFruit >= 400) W.push(`About ${fmt(A.vegFruit)} g of veg and fruit a day: the WHO's 400 g, done.`);
  if (A.dairy >= 400) W.push('Plenty of dahi and milk: good for your bones.');
  if (week.fishDays >= 1) W.push('Fish this week: great for your heart and joints.');
  if (waterAvg && waterOk >= 4) W.push(`You reached your water goal on ${waterOk} days.`);
  if (t && Math.abs(A.kcal - t.kcal) <= t.kcal * 0.1) W.push(`Your calories averaged ${fmt(A.kcal)} a day, within 10% of your target.`);
  if (trend && goalMovesRight(goal, trend.perWeek)) W.push(trendWin(goal, trend.perWeek));
  if (steps >= 8000) W.push(`About ${fmt(steps)} steps a day. Moving between workouts is what keeps fat loss easy.`);
  if (!W.length) W.push(n >= 3 ? `You logged ${n} days. Starting is the hardest part, and you've started.` : 'You started. That\'s the hardest part.');
  report.wins = W.slice(0, 3);

  /* ---------- Focus: what to ADD next week (top two) ---------- */
  const F = [];
  const female = p.sex === 'female';
  if (t && A.protein < t.protein * 0.8) F.push({ id: 'protein', score: o.rehab ? 10 : 9, title: 'Add a protein to each meal',
    why: `You averaged ${fmt(A.protein)} g a day; your target is ${t.protein} g. Protein is what turns training into muscle${o.rehab ? ' and what your body repairs with while you heal' : ''}.`,
    tip: 'Easy adds: 2 eggs at breakfast, a katori of dahi with lunch, an extra piece of chicken or a seekh kebab at dinner, or chana chaat as a snack.' });
  if (A.vegFruit < 300) F.push({ id: 'veg', score: 8, title: 'Add colour: salad or fruit with two meals',
    why: `About ${fmt(A.vegFruit)} g of veg and fruit a day. 400 g brings vitamin C, folate, potassium and fibre, which help energy, recovery and digestion.`,
    tip: 'A plate of kachumber with lunch and dinner, and a fruit (banana, apple, guava, orange) as a snack, gets you there.', nutrients: ['Vitamin C', 'Folate', 'Potassium', 'Fibre'] });
  if (waterAvg !== null && waterAvg < report.water.goal * 0.75) F.push({ id: 'water', score: 7, title: 'A few more glasses of water',
    why: `You averaged ${fmt(waterAvg)} glasses; about ${report.water.goal} suits your weight, plus 2 on training days. Even mild dehydration makes workouts feel harder.`,
    tip: 'Keep a bottle where you can see it, have a glass with every meal, and one before and after training.' });
  if (t && goal === 'lose' && !o.rehab && A.kcal > t.kcal * 1.1) F.push({ id: 'kcal-high', score: 7, title: 'One easy swap a day',
    why: `Your days averaged ${fmt(A.kcal)} kcal against ${fmt(t.kcal)}. No need to cut anything you love, just trim the oil.`,
    tip: A.outShare > 0.35 ? 'When eating out, pick tikka, boti or tandoori over karahi, or ask for less oil. That alone can save 150–250 kcal a meal.' : 'At home, measure the oil with a spoon instead of pouring, and skim the tarri off the top of the salan.' });
  if (t && (goal !== 'lose' || o.rehab) && A.kcal < t.kcal * 0.75) F.push({ id: 'kcal-low', score: o.rehab ? 9 : 7, title: 'Eat enough to recover',
    why: `You averaged ${fmt(A.kcal)} kcal against ${fmt(t.kcal)}. ${o.rehab ? 'Healing tissue needs energy; this isn\'t the time to under-eat.' : 'Under-eating stalls muscle gain and makes training feel heavy.'}`,
    tip: 'Add a snack you enjoy: a banana with peanut butter, a glass of milk, a handful of nuts, or an extra roti at lunch.' });
  if (steps !== null && steps < 5000) F.push({ id: 'walk', score: goal === 'lose' ? 7 : 5, title: 'A 15-minute walk after your biggest meal',
    why: `You averaged about ${fmt(steps)} steps a day. A short walk after eating lowers the blood-sugar rise from roti and rice, and adds 1,500–2,000 steps.`,
    tip: 'After lunch or dinner, walk before you sit down: round the block, the mall, or up and down the stairs.' });
  if (A.dairy < 250) F.push({ id: 'dairy', score: 6, title: 'A katori of dahi or a glass of milk a day',
    why: 'Dairy was light this week. It\'s the easiest source of calcium and protein, and milk is often fortified with vitamin D.',
    tip: 'Raita with lunch, lassi after training, or doodh before bed.', nutrients: ['Calcium', 'Vitamin D', 'Protein'] });
  if (female && week.legumeDays + week.meatDays < 4) F.push({ id: 'iron', score: 6, title: 'Iron-rich food a few times a week',
    why: 'Iron carries oxygen to your muscles, and women need nearly twice as much as men.',
    tip: 'Daal, chana, palak or red meat 3–4 times a week. Squeeze lemon on top (vitamin C helps absorb it), and have chai an hour away from meals, because tea blocks iron.', nutrients: ['Iron'] });
  else if (A.fibre < A.kcal / 1000 * 14 && week.legumeDays < 3) F.push({ id: 'fibre', score: 5, title: 'Daal, chana or rajma three times a week',
    why: `About ${fmt(A.fibre)} g of fibre a day; around ${fmt(A.kcal / 1000 * 14)} g keeps digestion and hunger steady.`,
    tip: 'Swap one meat salan for daal, or add chana chaat as a snack. Choose atta roti over naan.', nutrients: ['Fibre', 'Magnesium'] });
  if (week.fishDays === 0 && n >= 5) F.push({ id: 'fish', score: 4, title: 'Fish once this week',
    why: 'Fish brings omega-3 fats for your heart and joints, which other foods rarely do.',
    tip: 'Fish curry, grilled fish, or Lahori fish now and then. Walnuts and flaxseed help too.', nutrients: ['Omega-3'] });
  if (week.fried + week.sweet >= 7) F.push({ id: 'treats', score: 4, title: 'Keep the treats, swap one',
    why: `${week.fried + week.sweet} fried or sweet items this week. Enjoy them, and make one swap to keep your energy steady.`,
    tip: 'Roasted chana instead of pakoray with chai, or fruit chaat instead of mithai on one evening.' });
  F.sort((a, b) => b.score - a.score);
  report.focus = F.slice(0, 2);
  // Iron matters too much to drop for women: if it didn't make the top two, it becomes a gentle note.
  const iron = F.slice(2).find(f => f.id === 'iron');
  if (iron) report.notes.push(`${iron.why} ${iron.tip}`);

  /* ---------- Worth knowing (gentle, food first) ---------- */
  if (A.dairy < 250 && week.fishDays === 0) report.notes.push('Vitamin D comes mostly from sunlight, and many people in Pakistan and India are low. 15–20 minutes of sun on your arms helps, and a blood test is worth asking your doctor about.');
  if (week.meatDays === 0 && week.eggDays === 0 && A.dairy < 250) report.notes.push('Vitamin B12 is found almost only in animal foods. If you mostly eat vegetarian, ask your doctor about checking B12.');
  const act = activityFromSteps(steps, trainDays.size);
  if (act && p.activity && act !== p.activity) report.notes.push(`Your steps and training suggest “How active” should be ${({ low: 'Train 1–2 days', mid: 'Train 3–5 days', high: 'Train 6–7 days or a physical job' })[act]}. Change it under Your targets for a more accurate calorie target.`);
  // Weekdays vs Fri–Sun: weekend eating often undoes the week (Racette 2008). Only said when the gap is real.
  const we = stats.filter(s => [0, 5, 6].includes(new Date(s.k + 'T12:00').getDay())), wd = stats.filter(s => ![0, 5, 6].includes(new Date(s.k + 'T12:00').getDay()));
  if (we.length && wd.length >= 2) {
    const av = a => a.reduce((x, s) => x + s.kcal, 0) / a.length, gap = av(we) - av(wd);
    if (gap >= 300) { report.weekend = { weekday: Math.round(av(wd) / 10) * 10, weekend: Math.round(av(we) / 10) * 10 };
      report.notes.push(`Weekdays about ${fmt(report.weekend.weekday)} kcal, Fri–Sun about ${fmt(report.weekend.weekend)}${A.outShare > 0.3 ? `, with ${Math.round(A.outShare * 100)}% of your calories from eating out` : ''}. Planning one weekend meal ahead closes most of that gap.`); }
  }
  if (A.unknownShare > 0.4) report.notes.push('Many of your foods came from the recipe list, so the veg and dairy counts may be partial.');

  // Real maintenance from the scale: what you ate, minus what the weight change says you stored.
  if (trend && trend.spanDays >= 13 && n >= 5 && t) {
    const real = A.kcal - trend.perWeek * 7700 / 7;
    if (Math.abs(real - t.kcal / (1 + ({ lose: -0.2, gain: 0.1 }[goal] || 0))) > 200) report.maintenance = Math.round(real / 10) * 10;
  }
  if (report.maintenance) report.notes.push(`Going by your logs and your scale, your body seems to maintain at about ${fmt(report.maintenance)} kcal a day. QK will use this to fine-tune your target.`);

  report.line = o.rehab ? 'Healing well is the goal right now. Eat to recover, and the training will follow.'
    : report.focus.length ? 'Small adds, not big cuts. Pick one of these and make it yours this week.'
    : 'A really solid week. Keep doing exactly this.';
  return report;
}

function goalMovesRight(goal, perWeek) {
  if (goal === 'lose') return perWeek <= -0.1 && perWeek >= -1.2;
  if (goal === 'gain') return perWeek >= 0.05 && perWeek <= 0.6;
  return Math.abs(perWeek) < 0.25;
}
function trendWin(goal, perWeek) {
  const v = Math.abs(perWeek).toFixed(1);
  return goal === 'lose' ? `Down about ${v} kg a week: steady, sustainable fat loss.`
    : goal === 'gain' ? `Up about ${v} kg a week: lean, steady gaining.`
    : 'Your weight is holding steady, right where you want it.';
}

/** Plain-text version for "Send to QK". */
export function reportText(r, name = '') {
  if (!r.enough) return r.line;
  const L = [`${name ? name + "'s" : 'My'} week of food (${r.logged} days logged)`];
  L.push(`Average: ${fmt(r.avg.kcal)} kcal, ${fmt(r.avg.protein)} g protein, ${fmt(r.avg.vegFruit)} g veg and fruit a day.`);
  if (r.water.avg !== null) L.push(`Water: ${fmt(r.water.avg)} glasses a day.`);
  if (r.trend) L.push(`Weight: ${r.trend.perWeek > 0 ? '+' : ''}${r.trend.perWeek.toFixed(1)} kg a week.`);
  L.push('', 'Went well:', ...r.wins.map(w => '• ' + w));
  if (r.focus.length) L.push('', 'Next week:', ...r.focus.map(f => `• ${f.title}`));
  return L.join('\n');
}
