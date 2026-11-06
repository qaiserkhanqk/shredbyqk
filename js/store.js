// Local persistence. In production replace with a backend (Supabase/Firebase) so QK can see
// every client's sessions, streaks and scans from a coach dashboard.
const KEY = 'shred_qk_v1';
const blank = () => ({ profile: { name: '', sex: 'male', heightCm: '', weeklyGoal: 4 }, sessions: [], scans: [], checkins: [], coachPhoto: null, plan: { days: [], time: '', place: '' } });

export function load() {
  try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return blank(); }
}
export function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { console.warn('save failed', e); }
}

const day = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };

export function activeDays(s) {
  return new Set([...s.sessions.map(x => day(x.at)), ...s.checkins.map(x => day(x.at))]);
}

// Streak = consecutive days kept "on plan". Unplanned rest days don't break it (rest is part of
// training); missing a PLANNED day does. With no plan set, one rest day in a row is allowed.
export function streak(s) {
  const days = activeDays(s), planned = new Set(s.plan?.days || []);
  let n = 0, restRun = 0; const d = new Date();
  if (!days.has(day(d))) d.setDate(d.getDate() - 1); // today isn't over yet
  for (let i = 0; i < 400; i++) {
    if (days.has(day(d))) { n++; restRun = 0; }
    else if (planned.size ? planned.has(d.getDay()) : ++restRun > 1) break;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function thisWeek(s) {
  const now = new Date(); const start = new Date(now); start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // Monday
  const from = day(start);
  return [...activeDays(s)].filter(d => d >= from).length;
}

export function daysSinceLast(s) {
  const all = [...s.sessions, ...s.checkins].map(x => x.at);
  if (!all.length) return null;
  return Math.floor((Date.now() - Math.max(...all)) / 86400000);
}
