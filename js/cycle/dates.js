// Calendar-date helpers for cycle tracking.
//
// Rule: every cycle record is a LOCAL CALENDAR DATE string 'YYYY-MM-DD' chosen by the user, never a UTC
// timestamp. Day arithmetic is done on those strings through UTC midnight, so daylight-saving changes and
// travel can never move a logged period to a different day. "Today" is the device's local date.

const DAY = 864e5;
const RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDate(s) {
  const m = typeof s === 'string' && RE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
const toUTC = s => { const m = RE.exec(s); return Date.UTC(+m[1], +m[2] - 1, +m[3]); };
const fromUTC = t => { const d = new Date(t); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };

export const addDays = (s, n) => fromUTC(toUTC(s) + n * DAY);
/** Whole days from a to b (b − a). */
export const diffDays = (a, b) => Math.round((toUTC(b) - toUTC(a)) / DAY);
export const weekday = s => new Date(toUTC(s)).getUTCDay(); // 0 = Sunday

/** The calendar date of an instant in a given IANA time zone (default: the device's zone). */
export function localDate(epochMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(epochMs));
  const g = t => parts.find(p => p.type === t).value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}
/** Minutes since local midnight of an instant in a given time zone. */
export function localMinutes(epochMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(epochMs));
  return +parts.find(p => p.type === 'hour').value * 60 + +parts.find(p => p.type === 'minute').value;
}
export const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
export const today = (now = Date.now(), tz = deviceTimeZone()) => localDate(now, tz);

/** 'HH:MM' → minutes; returns null when invalid. */
export function hm(s) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s || '');
  return m ? +m[1] * 60 + +m[2] : null;
}
export const fmtHM = mins => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '2026-11-03' → '3 Nov'. */
export const human = s => { const m = RE.exec(s); return m ? `${+m[3]} ${MONTHS[+m[2] - 1]}` : ''; };
