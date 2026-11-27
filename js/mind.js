// Mind check: when sleep or stress has been poor for a few days, QK asks how they're doing, and answers with
// reassurance built from their own numbers. Pure, unit tested. Research: SCIENCE.md "Mind check".
const DAY = 864e5;
const dayKey = t => new Date(t).toDateString();

/** Poor days in the last 4: morning check with sleep quality or stress 5+ on the Hooper 1–7 scale (or a "rough"
 *  one-tap answer), or the readiness question answered "slept badly". One answer per day. */
export function poorDays(S, now = Date.now()) {
  const days = new Set();
  for (const r of S.readiness || []) if (now - r.at < 4 * DAY && ((r.sleepQ ?? 0) >= 5 || (r.stress ?? 0) >= 5 || r.feel === 'rough')) days.add(dayKey(r.at));
  for (const c of S.checkinLog || []) if (now - c.at < 4 * DAY && c.sleep === 'bad') days.add(dayKey(c.at));
  return days.size;
}

/** Ask when 2+ of the last 4 days were poor, at most once every 5 days, and not again for a week after "struggling"
 *  (they get the support card instead). */
export function mindDue(S, now = Date.now()) {
  const last = (S.mind || []).slice(-1)[0];
  if (last && now - last.at < 5 * DAY) return false;
  return poorDays(S, now) >= 2;
}

/** Reassurance from their own numbers: things that are going well, most convincing first. */
export function goodNews(S, now = Date.now()) {
  const out = [], real = (S.sessions || []).filter(s => !s.demo);
  const days = n => new Set(real.filter(s => now - s.at < n * DAY).map(s => dayKey(s.at))).size;
  const d14 = days(14), d30 = days(30);
  if (d14 >= 4) out.push(`You've still trained ${d14} days in the last two weeks. That consistency doesn't disappear after a few bad nights.`);
  else if (d30 >= 4) out.push(`You've trained ${d30} days this month. The work you've put in is still in your body.`);
  const hr = (S.vitals || []).filter(v => v.bpm).sort((a, b) => a.at - b.at);
  const recent = hr.filter(v => now - v.at < 7 * DAY).map(v => v.bpm), before = hr.filter(v => now - v.at >= 7 * DAY && now - v.at < 37 * DAY).map(v => v.bpm);
  if (recent.length && before.length) {
    const r = Math.min(...recent), b = Math.min(...before);
    if (r <= b + 3) out.push(`Your resting heart rate is ${Math.round(r)}, right where it usually is. Your body is coping fine.`);
  }
  const fa = (S.fitage || []).slice(-1)[0];
  if (fa && fa.fitnessAge < fa.age) out.push(`Your Fitness Age is ${fa.fitnessAge}, younger than you are. A rough patch doesn't change that.`);
  const calm = (S.calm || []).filter(c => now - c.at < 30 * DAY).length;
  if (calm) out.push(`You've done ${calm} calm session${calm > 1 ? 's' : ''} this month. You already know how to bring your stress down.`);
  if (!out.length) out.push('A few bad nights happen to everyone. Sleep and mood bounce back, especially with a routine like the one you are building.');
  return out.slice(0, 3);
}

/** What QK says back for each answer. 'struggling' always includes reaching out to a person. */
export function reply(answer, S, now = Date.now()) {
  const news = goodNews(S, now);
  if (answer === 'good') return { title: 'Glad to hear it', text: `${news[0]} Tonight: same bedtime, screens away 30 minutes before, and keep caffeine to the morning.`, light: false };
  if (answer === 'low') return { title: 'Thanks for telling me', text: `${news.join(' ')} Today I've made your session a little lighter. A 10-minute calm session before bed helps sleep too.`, light: true };
  return {
    title: "I'm really glad you told me", light: true, support: true,
    text: `${news[0]} But how you feel matters more than any number. Please talk to someone today: a friend, family, or a doctor. If you ever feel unsafe, call your local emergency number now.`,
  };
}
