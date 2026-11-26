// Monthly program refresh: keeps clients from getting bored without breaking what works.
// Every 4 weeks QK builds the next "month" (block) of the same program:
//  - Same formula: same days, same slot structure, same movement pattern in each slot.
//  - New exercises: each slot gets a similar exercise (same pattern / muscles) it hasn't used recently.
//    Strength-sport programs keep their main competition lift; beginners keep their main lifts.
//  - Rep ranges rotate: base → volume (higher reps) → strength (lower reps) → base …
//  - Volume follows what the lifter actually did: missed sessions → fewer sets; every session done with
//    clean form → one more set on the main lifts.
//  - Exercises the lifter swapped out are never brought back.
// Pure functions, unit tested.

/** Similar exercises for a swap, best first. */
export function alternatives(id, lib, { avoid = [], exclude = [], n = 6 } = {}) {
  const me = lib[id]; if (!me) return [];
  const mus = new Set(me.muscles || []);
  const score = x => {
    let s = 0;
    if (me.pattern && x.pattern === me.pattern) s += 4;
    if ((x.kind || 'gym') === (me.kind || 'gym')) s += 2;
    for (const m of x.muscles || []) if (mus.has(m)) s += (m === me.muscles?.[0] ? 2 : 1);
    if (x.equipment === me.equipment) s += 1;
    if (x.pattern && !me.pattern) s -= 1;
    return s;
  };
  return Object.values(lib)
    // Same type of training (HYROX with HYROX, Olympic with Olympic) and, for camera lifts, the same movement.
    .filter(x => x.id !== id && !x.rehab && !avoid.includes(x.id) && !exclude.includes(x.id) && (x.kind || 'gym') === (me.kind || 'gym') && (!me.pattern || x.pattern === me.pattern))
    .map(x => ({ id: x.id, s: score(x) }))
    .filter(x => x.s >= 4)
    .sort((a, b) => b.s - a.s || a.id.localeCompare(b.id))
    .slice(0, n).map(x => x.id);
}

const PHASES = ['base', 'volume', 'strength'];
export const phaseOf = block => PHASES[(block - 1) % 3];

/** Reps text for a block phase. '8-12' → volume '10-15' / strength '6-8'; '5' → '8' / '3'. Time and distance unchanged. */
export function repsFor(reps, phase) {
  if (phase === 'base') return reps;
  const m = /^(\d+)(?:-(\d+))?$/.exec(String(reps)); if (!m) return reps;
  const lo = +m[1], hi = +(m[2] || m[1]);
  if (phase === 'volume') return lo === hi ? String(Math.min(lo + 3, 12)) : `${lo + 2}-${Math.min(hi + 3, 20)}`;
  return lo === hi ? String(Math.max(lo - 2, 2)) : `${Math.max(lo - 2, 3)}-${Math.max(hi - 4, lo)}`;
}

const KEEP_MAIN = ['Powerlifting', 'Olympic lifting', 'Gains'];
// Race stations and run sessions are the sport itself: they keep their place, only reps and volume move.
const FIXED_KINDS = ['hyrox', 'run'];

/**
 * Build the next block.
 * @param def program definition (programs.js)
 * @param cur { block, plan } the block just finished (plan = def.plan in block 1)
 * @param o { lib, avoid, compliance (0..1 of planned days done), clean (0..1 of reps clean) }
 * @returns { block, phase, plan, changes: [{ from, to, day }], volume: 'less'|'more'|'same', note }
 */
export function nextBlock(def, cur, { lib, avoid = [], compliance = 1, clean = 1 } = {}) {
  const block = (cur?.block || 1) + 1, phase = phaseOf(block), prev = cur?.plan || def.plan;
  const keepMain = KEEP_MAIN.some(g => def.goal.startsWith(g));
  const volume = compliance < 0.6 ? 'less' : compliance >= 0.9 && clean >= 0.8 ? 'more' : 'same';
  const changes = [];
  const plan = prev.map((day, di) => {
    const used = new Set(day.items.map(it => it[0]));
    const base = def.plan[di] || day;
    const items = day.items.map((it, ii) => {
      const orig = base.items[ii] || it;
      let id = it[0];
      if (!(keepMain && ii === 0) && !FIXED_KINDS.includes(lib[orig[0]]?.kind)) {
        // Rotate through the original exercise and its close alternatives, never repeating last month's.
        const pool = [orig[0], ...alternatives(orig[0], lib, { avoid, n: 4 })].filter(x => !avoid.includes(x) && lib[x]);
        const next = pool.find(x => x !== it[0] && !used.has(x)) || it[0];
        if (next !== id) { changes.push({ from: id, to: next, day: day.name }); used.delete(id); used.add(next); id = next; }
      }
      let sets = orig[1];
      const main = ii < 2;
      // Single-session items (a run, a timed piece) keep one set; volume moves on the set-based work.
      if (volume === 'less' && !main && sets > 2) sets -= 1;
      if (volume === 'more' && main && sets > 1 && sets < 10) sets += 1;
      return [id, sets, repsFor(orig[2], phase), orig[3], orig[4]].filter((x, k) => k < 4 || x);
    });
    return { ...day, items };
  });
  const note = {
    less: 'You trained fewer days than planned last month, so QK trimmed the extra sets to fit your week.',
    more: 'You hit every session with clean form, so QK added a set to your main lifts.',
    same: 'Same amount of work as last month.',
  }[volume];
  const phaseNote = { base: 'Back to the core rep ranges.', volume: 'Volume month: more reps per set.', strength: 'Strength month: heavier, fewer reps.' }[phase];
  return { block, phase, plan, changes, volume, note: `${phaseNote} ${note}` };
}

/** Swap one exercise everywhere in a plan. */
export function swapIn(plan, from, to) {
  return plan.map(day => ({ ...day, items: day.items.map(it => (it[0] === from ? [to, ...it.slice(1)] : it)) }));
}

/** How much of the plan was done in the last `weeks` weeks (program days logged ÷ planned). */
export function compliance(active, daysPerWeek, { now = Date.now(), weeks = 4 } = {}) {
  const from = now - weeks * 7 * 864e5, done = (active?.log || []).filter(l => l.at >= from).length;
  return Math.min(1, done / (daysPerWeek * weeks || 1));
}
