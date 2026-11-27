// Hands-free commands during a workout: "next", "skip", "done", "heavier", "lighter", "80 kilos".
// English and common Urdu / Roman Urdu words. Pure parser, unit tested; the microphone part lives in app.js.
const ONES = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

/** "one hundred and twenty two point five" → 122.5; digits pass through. */
export function words2num(s) {
  const t = s.toLowerCase().replace(/-/g, ' ').replace(/\band a half\b/, 'point five');
  const d = t.match(/\d+(?:[.,]\d+)?/); if (d) return parseFloat(d[0].replace(',', '.'));
  let n = 0, cur = 0, frac = null, seen = false;
  for (const w of t.split(/\s+/)) {
    if (frac !== null) { if (w in ONES) { frac += ONES[w] / 10; } continue; }
    if (w in ONES) { cur += ONES[w]; seen = true; }
    else if (w in TENS) { cur += TENS[w]; seen = true; }
    else if (w === 'hundred') { cur = (cur || 1) * 100; seen = true; }
    else if (w === 'point') frac = 0;
  }
  n += cur;
  return seen ? n + (frac || 0) : null;
}

const RULES = [
  ['next', /\b(next|go on|continue|agla|agle|aage)\b/],
  ['skip', /\b(skip|skip it|chhor|chhoro|chor do|nahi karna)\b/],
  ['done', /\b(done|finish(ed)?|stop|end set|that's it|bas|ho gaya|khatam)\b/],
  ['heavier', /\b(heavier|more weight|add weight|go up|bhari|zyada)\b/],
  ['lighter', /\b(lighter|less weight|go down|halka|kam)\b/],
  ['rest', /\b(rest|pause|aaram)\b/],
  ['start', /\b(start|begin|go|shuru)\b/],
];
/**
 * @returns null or { cmd: 'weight'|'next'|'skip'|'done'|'heavier'|'lighter'|'rest'|'start', kg?, unit? }
 */
export function parse(text) {
  const t = String(text || '').toLowerCase().trim(); if (!t) return null;
  const unit = /\b(kg|kgs|kilo|kilos|kilograms?)\b/.test(t) ? 'kg' : /\b(lb|lbs|pounds?)\b/.test(t) ? 'lb' : null;
  if (unit) { const kg = words2num(t); if (kg > 0 && kg < 700) return { cmd: 'weight', kg, unit }; }
  for (const [cmd, re] of RULES) if (re.test(t)) return { cmd };
  return null;
}
