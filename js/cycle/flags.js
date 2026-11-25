// Feature flags. Every cycle feature is OFF by default, so merging this code to `main` (which auto-deploys
// to GitHub Pages) does not expose a sensitive-health-data feature to real users. Flags are not health
// data, so they live in plain localStorage under their own key.

export const FLAG_DEFS = {
  cycleTracking: { default: false, label: 'Cycle tracking (prototype)', desc: 'Prototype only. Use synthetic or demo data, not real client data, until a privacy and clinical review is done.' },
  phaseEducation: { default: false, label: 'Phase education', desc: 'Shows simplified phase information only when it can be supported, with a "not enough data" state otherwise.' },
  patternInsights: { default: false, label: 'Symptom pattern findings (research)', desc: 'Unvalidated. In synthetic tests, about 1 in 4 people with no real pattern still got one. Off until prospective testing shows it helps more than it misleads.' },
  symptomForecast: { default: false, label: 'Symptom forecast (experimental)', desc: 'Off until prospective testing shows it beats each person\'s own simple baseline.' },
  quickSuggestions: { default: false, label: 'One-tap suggestions', desc: 'Pre-fills answers from your own past patterns ("Same as usual around now?"). Nothing is saved unless you tap Yes.' },
  sensorPrompts: { default: false, label: 'Wearable-timed questions', desc: 'Uses your wearable only to decide WHEN to ask "has your period started?" or "how are you feeling?". It never records anything for you.' },
  lhTests: { default: false, label: 'Ovulation test results (research)', desc: 'Lets you record home ovulation test results exactly as you read them, for research comparisons. The app does not interpret them or use them for estimates, and they are not for contraception.' },
  companion: { default: false, label: 'Zara check-ins (prototype)', desc: 'On the first days of your period and around your estimated start, your companion Zara (you can rename her) asks how you are feeling. One tap saves only what you choose; nothing is guessed, and your answers stay on this phone. Wording awaiting clinician review.' },
  pregnancyMode: { default: false, label: 'Pregnancy and postpartum mode (prototype)', desc: 'Turn on pregnancy mode in "Situations" with your due date: weeks and trimester from your due date, pregnancy symptoms, urgent warning signs and a weekly check-in. After the birth: recovery, mood, check-ups and when periods return. Never a diagnosis. Wording awaiting clinician review.' },
  midlifeMode: { default: false, label: 'Perimenopause and menopause mode (prototype)', desc: 'When you mark "Perimenopause or menopause": extra symptoms to track, and plain descriptions of your logged bleeding pattern against published research criteria. Never a diagnosis or treatment advice. Wording awaiting clinician review.' },
  comfortSuggestions: { default: false, label: 'Comfort suggestions (prototype)', desc: 'After you log moderate or severe pain: a few low-risk things some people find helpful, then "did it help?", so the list learns what works for you. Not medical advice. Wording awaiting clinician review.' },
  temperatureEstimate: { default: false, label: 'Band-adjusted estimate (research)', desc: 'Once your band has seen a temperature rise in this cycle and in at least 2 past cycles, shows a second estimate from that rise and your own past rise-to-period gaps. Tested on synthetic data only; not validated on real people. Your dates-only estimate is always shown too.' },
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
