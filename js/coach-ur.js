// Urdu for QK's short spoken workout cues: rep counts, sets, rest, go, switch sides, done.
// Longer coaching sentences stay English until a native speaker writes them (the same rule as the Food
// screen), rather than machine-sounding Urdu. Returns null when a line has no Urdu version.
const N = ['صفر', 'ایک', 'دو', 'تین', 'چار', 'پانچ', 'چھ', 'سات', 'آٹھ', 'نو', 'دس', 'گیارہ', 'بارہ', 'تیرہ', 'چودہ', 'پندرہ', 'سولہ', 'سترہ', 'اٹھارہ', 'انیس', 'بیس'];
const EN = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
/** 7 or "seven" → سات (1–20; larger numbers stay as digits, which Urdu voices read). */
export const urNum = x => { const n = /^\d+$/.test(String(x)) ? +x : EN.indexOf(String(x).toLowerCase()); return n >= 0 && n <= 20 ? N[n] : String(x); };
const NUMW = `(\\d+|${EN.join('|')})`;

const RULES = [
  [new RegExp(`^${NUMW}\\.?$`, 'i'), m => urNum(m[1])],
  [new RegExp(`^${NUMW}\\. (Good rep|That's it|Perfect|Strong|Lovely)\\b.*$`, 'i'), m => `${urNum(m[1])}۔ شاباش!`],
  [/^Set (\d+) of (\d+)\.$/, m => `سیٹ ${urNum(m[1])}، کل ${urNum(m[2])} میں سے۔`],
  // Only when there's no form tip to pass on: a tip is never dropped for the sake of Urdu.
  [/^Set done\. (\d+) reps, (\d+) clean\.(?!.*One thing for next set).*Great form\. Keep it up\.$/, m => `سیٹ مکمل۔ ${urNum(m[1])} ریپس، ${urNum(m[2])} صاف۔ بہترین فارم۔`],
  [/^Rest\.(?: Next up: .*)?$/, () => 'آرام کریں۔'],
  [/^Rest over\. Let's go again\.$/, () => 'آرام ختم۔ چلیں دوبارہ۔'],
  [/^Switch sides\.$/, () => 'سائیڈ بدلیں۔'],
  [/^Go!?$/, () => 'شروع!'],
  [/^Go\. Hold it\.$/, () => 'شروع۔ ہولڈ کریں۔'],
  [/^Two more\. Stay controlled\.$/, () => 'دو اور۔ کنٹرول رکھیں۔'],
  [/^Let's go\. (\d+) exercises today\..*$/, m => `چلیں شروع کرتے ہیں۔ آج ${urNum(m[1])} ورزشیں ہیں۔`],
  [/^Workout done\..*$/, () => 'ورزش مکمل۔ شاباش! ہر سیٹ محفوظ ہو گیا۔'],
  [/^Perfect set\..*$/, () => 'زبردست سیٹ! ہر ریپ صاف۔'],
];
export function toUrdu(text) {
  const t = String(text || '').trim();
  for (const [re, f] of RULES) { const m = t.match(re); if (m) return f(m); }
  return null;
}
