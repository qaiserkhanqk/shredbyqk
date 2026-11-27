// The question budget: personal, but never too many questions (product owner, 2026-11-27).
//   • After BACKOFF.AFTER_NOT_NOW "Not now" taps in a row for one kind of question, it is asked only every
//     BACKOFF.EVERY_DAYS days, until she answers again. It backs off; it never stops for good.
//   • "Light" or "Normal": how often Zara may ask (Light = only before her period and on its first day).
// UI choices to avoid question fatigue, not physiology. Nothing here creates a notification.
import { CycleError } from './model.js';
import { diffDays } from './dates.js';

export const BACKOFF = Object.freeze({ AFTER_NOT_NOW: 3, EVERY_DAYS: 2 });
export const ASK_LEVELS = Object.freeze(['light', 'normal']);

const slot = (s, kind) => ((s.asks ||= {})[kind] ||= { streak: 0, last: null });

/** May we ask a question of this kind today? */
export function askAllowed(s, kind, today) {
  const a = s.asks?.[kind];
  if (!a || a.streak < BACKOFF.AFTER_NOT_NOW || !a.last) return true;
  return diffDays(a.last, today) >= BACKOFF.EVERY_DAYS;
}
/** She tapped "Not now". */
export function recordNotNow(s, kind, today) {
  const a = slot(s, kind);
  if (a.last === today) return s; // the same day counts once
  a.streak += 1; a.last = today; return s;
}
/** She answered: back to normal. */
export function recordAnswer(s, kind) { const a = slot(s, kind); a.streak = 0; a.last = null; return s; }

export const askLevel = s => (ASK_LEVELS.includes(s.settings?.askLevel) ? s.settings.askLevel : 'normal');
export function setAskLevel(s, level) {
  if (!ASK_LEVELS.includes(level)) throw new CycleError('INVALID_INPUT');
  (s.settings ||= {}).askLevel = level; return s;
}
