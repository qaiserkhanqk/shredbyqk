import { sanitizePlan } from './dietplan.js';

// Client-written data (scores, program, food week, diet plan) is untrusted: anyone with an account can write any
// JSON into their own profile. Clean it on load: numbers must be numbers, lists must be lists, plans are rebuilt
// from the app's own food list. Rendering still escapes every string.
const NUMERIC = new Set(['kcal', 'protein', 'carbs', 'fat', 'delta', 'kcalAdjust', 'stepGoal', 'weightPerWeek', 'maintenance', 'meals', 'logged', 'foodDays14',
  'daysSinceFood', 'sleepH', 'rough', 'stressed', 'mornings', 'strength', 'health', 'nutrition', 'recovery', 'activity', 'workout', 'fitnessAge', 'age', 'block',
  'water', 'steps', 'vegFruit', 'outShare', 'kg', 'daysLogged', 'avgKcal', 'avgProtein']);
const LISTS = new Set(['focus', 'wins', 'items']);
export function cleanJSON(v, key = '') {
  if (NUMERIC.has(key)) { const n = typeof v === 'number' ? v : NaN; return Number.isFinite(n) ? n : null; }
  if (LISTS.has(key) && !Array.isArray(v)) return [];
  if (Array.isArray(v)) return v.slice(0, 50).map(x => cleanJSON(x));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).slice(0, 60).map(([k, x]) => [k, cleanJSON(x, k)]));
  if (typeof v === 'string') return v.slice(0, 300);
  return typeof v === 'number' && !Number.isFinite(v) ? null : v;
}
export function cleanProfile(p) {
  const out = { ...p, name: String(p.name ?? '').slice(0, 80) };
  out.scores = p.scores && typeof p.scores === 'object' ? cleanJSON(p.scores) : null;
  out.program = p.program && typeof p.program === 'object' ? { id: String(p.program.id ?? ''), name: String(p.program.name ?? '').slice(0, 80), block: Number.isFinite(p.program.block) ? p.program.block : 1, start: p.program.start, blockStart: p.program.blockStart } : null;
  out.food_week = p.food_week && typeof p.food_week === 'object' ? cleanJSON(p.food_week) : null;
  if (out.food_week?.plan && typeof out.food_week.plan.at !== 'string') out.food_week.plan.at = '';
  if (out.food_week?.checkin?.last && typeof out.food_week.checkin.last.day !== 'string') out.food_week.checkin.last.day = '';
  try { out.diet_plan = p.diet_plan?.meals ? sanitizePlan(p.diet_plan) : null; } catch { out.diet_plan = null; }
  return out;
}
