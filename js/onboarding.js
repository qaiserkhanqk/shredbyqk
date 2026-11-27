// Personalised sign-up: which questions to ask and what each answer turns on (product owner's flow, 2026-11-27).
//   • "Which best describes you?" Woman / Man / Other or prefer not to say.
//   • A man never sees period tracking (he can still find the switch in settings; it is never shown to him).
//   • A woman, and anyone who answers "Other or prefer not to say", is asked her age, then, from 13, whether she would
//     like to track her periods. Under 13, period tracking is never turned on.
//   • "Yes": period tracking and Zara, her cycle companion, are turned on by HER answer (they stay off for everyone
//     else). Zara introduces herself on screen, never in a notification, and never as clinical or medical.
//   • "Not right now": pregnancy, after a birth, or menopause opens that mode instead; "just not now" changes nothing.
// The answers stay on the phone. The period answer is used only to set the switches; it is not stored with the profile.
export const ONBOARDING_VERSION = 'onboarding-0.1.0';
export const MIN_CYCLE_AGE = 13;
export const GENDERS = Object.freeze({ woman: 'Woman', man: 'Man', other: 'Other or prefer not to say' });
export const AGES = Object.freeze({ under13: 'Under 13', '13-17': '13 to 17', '18+': '18 or over' });
export const PERIODS = Object.freeze({ yes: 'Yes', notNow: 'Not right now', no: 'No' });
export const NOT_NOW = Object.freeze({ pregnant: 'I\'m pregnant', postpartum: 'I recently gave birth', menopause: 'Perimenopause or menopause', later: 'Just not now' });
export const ZARA_WELCOME = 'Hi, I\'m Zara, your cycle companion. I\'ll help you keep track of your cycle and check in with you around your period. Everything you tell me stays on this phone. You can rename me in settings.';
export const NOTES = Object.freeze({
  under13: `Period tracking is for ages ${MIN_CYCLE_AGE} and over.`,
  off: 'You can turn on period tracking any time in You > Settings.',
});

const valid = (v, set) => v == null || Object.hasOwn(set, v);

/**
 * @param {{gender?: string, age?: string, periods?: string, notNow?: string}} a her answers so far
 * @returns {{ask: {age: boolean, periods: boolean, notNow: boolean}, flags: object, route: 'today'|'cycle',
 *   intent: null|'pregnant'|'postpartum'|'menopause', zaraIntro: boolean, sex: 'female'|'male'|null, note: string|null}}
 */
export function personalise({ gender, age, periods, notNow } = {}) {
  if (!valid(gender, GENDERS) || !valid(age, AGES) || !valid(periods, PERIODS) || !valid(notNow, NOT_NOW)) throw new Error('INVALID_ANSWER');
  const askAge = gender === 'woman' || gender === 'other';
  const oldEnough = askAge && (age === '13-17' || age === '18+');
  const ask = { age: askAge, periods: oldEnough, notNow: oldEnough && periods === 'notNow' };
  const sex = gender === 'woman' ? 'female' : gender === 'man' ? 'male' : null;
  const out = (flags, route = 'today', extra = {}) => ({ ask, flags, route, intent: null, zaraIntro: false, sex, note: null, ...extra });
  if (!gender) return out({}); // skipped: nothing changes
  if (gender === 'man') return out({ cycleTracking: false, companion: false });
  if (askAge && age === 'under13') return out({ cycleTracking: false, companion: false }, 'today', { note: NOTES.under13 });
  if (!oldEnough || !periods) return out({});
  if (periods === 'yes') return out({ cycleTracking: true, companion: true }, 'cycle', { zaraIntro: true });
  if (periods === 'no') return out({ cycleTracking: false, companion: false }, 'today', { note: NOTES.off });
  // Not right now
  if (notNow === 'pregnant' || notNow === 'postpartum') return out({ cycleTracking: true, companion: true, pregnancyMode: true }, 'cycle', { intent: notNow, zaraIntro: true });
  if (notNow === 'menopause') return out({ cycleTracking: true, companion: true, midlifeMode: true }, 'cycle', { intent: 'menopause', zaraIntro: true });
  if (notNow === 'later') return out({ cycleTracking: false, companion: false }, 'today', { note: NOTES.off });
  return out({});
}
