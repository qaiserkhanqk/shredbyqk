// Rewards for good form. Pure functions, no browser APIs, so they are unit tested.
// The currency is CLEAN reps (reps with no form fault), not reps: what QK rewards is quality.
//  - Clean-rep milestones across all your training (25, 50, 100 … 5000), each with a name.
//  - Perfect sets: 5 or more reps, every one clean.
//  - Clean streaks inside a set (5, 10, 15, 20 in a row) are cheered live by the camera coach.
// Holds (planks) count seconds, not reps, so the app leaves them out of the clean-rep total.

export const TIERS = [
  { n: 25, name: 'Off the mark', medal: 'bronze' },
  { n: 50, name: 'Locked in', medal: 'bronze' },
  { n: 100, name: 'Century', medal: 'silver' },
  { n: 250, name: 'Built different', medal: 'silver' },
  { n: 500, name: 'Machine', medal: 'gold' },
  { n: 1000, name: 'Thousand club', medal: 'gold' },
  { n: 2500, name: 'Master of form', medal: 'platinum' },
  { n: 5000, name: 'QK legend', medal: 'platinum' },
];

// QK's cheers, said out loud the moment a milestone is reached. {name} is the lifter's first name.
const CHEERS = {
  25: '{name}, that\'s 25 clean reps. You\'re off the mark.',
  50: '50 clean reps, {name}. You\'re locked in.',
  100: 'One hundred clean reps! {name}, that\'s a century.',
  250: '250 clean reps. {name}, you\'re built different.',
  500: 'Five hundred clean reps, {name}. Absolute machine.',
  1000: 'One thousand clean reps! Welcome to the thousand club, {name}.',
  2500: '2500 clean reps. {name}, you\'ve mastered your form.',
  5000: 'Five thousand clean reps. {name}, you\'re a QK legend.',
};

/** Sessions that count: real camera sets (no demos, guided timers or hand-edited counts). */
const counts = (s, isHold) => s && !s.demo && !s.guided && !(isHold && isHold(s.ex));

/** All clean reps ever done. isHold(id) → true for exercises scored in seconds. */
export function lifetimeClean(sessions = [], isHold) {
  let n = 0; for (const s of sessions) if (counts(s, isHold)) n += Math.min(s.good || 0, s.reps || 0); return n;
}

/** The milestone passed when the total goes from `before` to `after`, or null. */
export function crossed(before, after) {
  let hit = null; for (const t of TIERS) if (before < t.n && after >= t.n) hit = t; return hit;
}

/** Milestones already earned, and the next one with how many clean reps are left. */
export function progress(total) {
  const earned = TIERS.filter(t => total >= t.n), next = TIERS.find(t => total < t.n) || null;
  const prevN = earned.length ? earned[earned.length - 1].n : 0;
  return { total, earned, next, left: next ? next.n - total : 0, frac: next ? (total - prevN) / (next.n - prevN) : 1 };
}

export const isPerfect = (reps, good) => reps >= 5 && good === reps;
export const perfectSets = (sessions = [], isHold) => sessions.filter(s => counts(s, isHold) && isPerfect(s.reps, s.good)).length;

/** What QK says for a milestone. */
export function cheer(tier, name = '') {
  const line = CHEERS[tier.n] || `${tier.n} clean reps. ${tier.name}.`;
  return line.replace(/\{name\},? ?/g, name ? `${name}, ` : '').replace(/, \./g, '.').replace(/^\w/, c => c.toUpperCase());
}

/** Rewards earned in a time window, for the weekly message to the coach. */
export function earnedBetween(sessions = [], from, to, isHold) {
  const before = lifetimeClean(sessions.filter(s => s.at < from), isHold);
  const upTo = lifetimeClean(sessions.filter(s => s.at < to), isHold);
  const tiers = TIERS.filter(t => before < t.n && upTo >= t.n);
  const perfect = perfectSets(sessions.filter(s => s.at >= from && s.at < to), isHold);
  return { tiers, perfect, total: upTo };
}
