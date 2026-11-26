// Supersets and circuits: exercises that share a group letter are done back to back.
// A program item is [id, sets, reps, rest, note?, group?]; group is a letter like 'A'.
// Two in a group = superset (A1/A2); three or more = circuit. Workout mode goes A1 → A2 → rest → A1 …
// Pure functions, unit tested.

export const groupOf = it => it?.[5] || null;

/** Labels like A1, A2, B1 for display; ungrouped items get none. */
export function labels(items) {
  const n = {}; return items.map(it => { const g = groupOf(it); if (!g) return ''; n[g] = (n[g] || 0) + 1; return g + n[g]; });
}

/** Group name for a set of items: "Superset" for two, "Circuit" for three or more. */
export const kindOf = (items, g) => (items.filter(it => groupOf(it) === g).length >= 3 ? 'Circuit' : 'Superset');

/**
 * The next exercise to do.
 * @param items the day's items, @param done id → sets done today, @param planned id → sets planned
 * @returns { id, rest: boolean } rest = take the rest period before it (false inside a superset round), or null when done.
 */
export function nextUp(items, done, planned, lastId = null) {
  const left = it => (done[it[0]] || 0) < (planned[it[0]] ?? it[1]);
  const first = items.find(left); if (!first) return null;
  const g = groupOf(first);
  if (!g) return { id: first[0], rest: true };
  // Within a group: the member with the fewest sets done, in order. Rest only when a round is complete.
  const members = items.filter(it => groupOf(it) === g && left(it));
  const min = Math.min(...members.map(it => done[it[0]] || 0));
  const next = members.find(it => (done[it[0]] || 0) === min);
  // A new round starts when every remaining partner is on the same set and we're back at the first one.
  const group = items.filter(it => groupOf(it) === g), d = it => done[it[0]] || 0;
  const roundStart = group.every(it => d(it) === d(group[0])) && next === group.find(left);
  const lastInGroup = lastId && items.some(it => it[0] === lastId && groupOf(it) === g);
  return { id: next[0], rest: !lastInGroup || roundStart };
}

/** Link an item with the next one (or unlink). Picks the next free letter. */
export function toggleLink(items, i) {
  const out = items.map(it => it.slice());
  const a = out[i], b = out[i + 1]; if (!a || !b) return out;
  if (groupOf(a) && groupOf(a) === groupOf(b)) { // unlink b (and anything after it in the run)
    const g = groupOf(a); for (let j = i + 1; j < out.length && groupOf(out[j]) === g; j++) out[j][5] = undefined;
    if (out.filter(it => groupOf(it) === g).length < 2) out.forEach(it => { if (groupOf(it) === g) it[5] = undefined; });
    return out.map(trim);
  }
  const used = new Set(out.map(groupOf).filter(Boolean));
  const g = groupOf(a) || groupOf(b) || 'ABCDEFGH'.split('').find(x => !used.has(x));
  a[4] ??= ''; b[4] ??= ''; a[5] = g; b[5] = g;
  return out.map(trim);
}
const trim = it => { const x = it.slice(); while (x.length > 4 && (x[x.length - 1] === undefined || x[x.length - 1] === '')) x.pop(); return x; };
