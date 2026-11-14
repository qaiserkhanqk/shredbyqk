// Feature flags. Every cycle feature is OFF by default, so merging this code to `main` (which auto-deploys
// to GitHub Pages) does not expose a sensitive-health-data feature to real users. Flags are not health
// data, so they live in plain localStorage under their own key.

export const FLAG_DEFS = {
  cycleTracking: { default: false, label: 'Cycle tracking (prototype)', desc: 'Prototype only. Use synthetic or demo data, not real client data, until a privacy and clinical review is done.' },
  phaseEducation: { default: false, label: 'Phase education', desc: 'Shows simplified phase information only when it can be supported, with a "not enough data" state otherwise.' },
  symptomForecast: { default: false, label: 'Symptom forecast (experimental)', desc: 'Off until prospective testing shows it beats each person\'s own simple baseline.' },
  temperatureResearch: { default: false, label: 'Temperature analysis (research)', desc: 'Looks for a possible retrospective rise in wrist skin temperature. Not used for period estimates.' },
};
const KEY = 'shred_flags_v1';

export function readFlags(storage = globalThis.localStorage) {
  let saved = {};
  try { saved = JSON.parse(storage?.getItem(KEY) || '{}'); } catch { saved = {}; }
  return Object.fromEntries(Object.entries(FLAG_DEFS).map(([k, d]) => [k, typeof saved[k] === 'boolean' ? saved[k] : d.default]));
}
export function setFlag(name, on, storage = globalThis.localStorage) {
  if (!(name in FLAG_DEFS)) throw new Error('unknown flag');
  const f = readFlags(storage); f[name] = !!on;
  try { storage.setItem(KEY, JSON.stringify(f)); } catch { /* storage blocked: flag stays in memory only */ }
  return f;
}
