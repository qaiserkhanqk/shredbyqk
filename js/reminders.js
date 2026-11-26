// Training-day reminders. Two layers, neither needs a server:
//  1. Calendar: a repeating event on each training day at the planned time, with an alert. Works on every
//     phone, even when the app is closed. Calendar entries can't change by themselves, so they point to the
//     app ("your weights are set"); the plan itself is in the app.
//  2. In-app: when the app is open (or opened) on a training day, a notification with today's actual plan.
// Real push notifications with the plan, when the app is closed, need the coach server (dashboard work).

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const pad = n => String(n).padStart(2, '0');
const esc = s => String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
// Lines over 75 octets must be folded (RFC 5545).
const fold = line => line.length <= 74 ? line : line.match(/.{1,73}/g).join('\r\n ');

/**
 * iCalendar text for weekly training reminders.
 * @param plan { days: [0..6], time: 'HH:MM', place }
 * @param o { name, url, now, alarmMin }
 */
export function icsFor(plan, { name = '', url = '', now = Date.now(), alarmMin = 30 } = {}) {
  const days = [...new Set(plan?.days || [])].sort();
  if (!days.length) return null;
  const [h, m] = (plan.time || '18:00').split(':').map(Number);
  // First occurrence: the next planned day from today, at the planned time (floating local time).
  const start = new Date(now); start.setHours(h, m || 0, 0, 0);
  for (let i = 0; i < 7 && !days.includes(start.getDay()); i++) start.setDate(start.getDate() + 1);
  const dt = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const end = new Date(start.getTime() + 60 * 60e3), stamp = new Date(now);
  const utc = `${stamp.getUTCFullYear()}${pad(stamp.getUTCMonth() + 1)}${pad(stamp.getUTCDate())}T${pad(stamp.getUTCHours())}${pad(stamp.getUTCMinutes())}${pad(stamp.getUTCSeconds())}Z`;
  const title = 'Train with QK';
  const desc = `${name ? name + ', y' : 'Y'}our weights for today are already set. Open Shred by QK, tap Start workout and follow QK.${url ? '\n' + url : ''}`;
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Shred by QK//Training reminders//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:shred-qk-training-${days.join('')}-${h}${m}@shredbyqk`, `DTSTAMP:${utc}`,
    `DTSTART:${dt(start)}`, `DTEND:${dt(end)}`, `RRULE:FREQ=WEEKLY;BYDAY=${days.map(d => DAYS[d]).join(',')}`,
    `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(desc)}`, ...(plan.place ? [`LOCATION:${esc(plan.place)}`] : []), ...(url ? [`URL:${url}`] : []),
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc('Training in ' + alarmMin + ' min. Your weights are set.')}`, `TRIGGER:-PT${alarmMin}M`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Is today a training day that hasn't been trained yet, and is it time for the reminder? */
export function dueToday(plan, { now = Date.now(), trainedToday = false, notifiedOn = '' } = {}) {
  const d = new Date(now), key = d.toDateString();
  if (!plan?.days?.includes(d.getDay()) || trainedToday || notifiedOn === key) return false;
  const [h, m] = (plan.time || '00:00').split(':').map(Number);
  return d.getHours() * 60 + d.getMinutes() >= h * 60 + (m || 0) - 60; // from an hour before the planned time
}
