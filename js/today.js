// "Your next step": the one thing Today shows. Pure function, unit tested.
// The rule: never make the client choose between several things. Pick the single most useful action now,
// explain why in one line, and keep everything else one tap away under Tools.

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// state: {
//   hour, weekday,                       current local time
//   plan: { days: [0..6] },              the client's training days (may be empty)
//   focus: 'train' | 'recover' | 'calm', what they said they want help with
//   readiness: 'go' | 'adjust' | 'recover' | null   (null = no check-in yet)
//   trainedToday, calmedToday,
//   rehab: null | { name, phase, phases, morningDue },
//   workout: { name, minutes, count },
// }
export function nextStep(s) {
  const planned = !s.plan?.days?.length || s.plan.days.includes(s.weekday);
  const late = s.hour >= 21;

  if (s.rehab?.morningDue) return {
    kind: 'rehab-morning', eyebrow: 'Rehab · quick check', title: `How does your ${s.rehab.name.toLowerCase()} feel this morning?`,
    sub: 'Ten seconds. It tells QK whether yesterday\'s load was right.', cta: 'Check in',
  };
  if (s.readiness === 'recover' && !s.trainedToday) return s.rehab ? {
    kind: 'rehab', eyebrow: 'Recovery day', title: `Gentle rehab: ${s.rehab.name}`,
    sub: 'Your check-in says rest today. Your rehab exercises are light enough to keep going.', cta: 'Start rehab',
  } : {
    kind: 'calm', eyebrow: 'Recovery day', title: 'Rest, breathe and recover',
    sub: 'Your check-in says your body needs a break. Five minutes of slow breathing helps it switch to recovery.', cta: 'Calm now',
  };
  if (s.trainedToday) return s.calmedToday || late ? {
    kind: 'done', eyebrow: 'Done for today', title: 'Well done. That\'s today\'s work.',
    sub: 'Recovery is where the progress is made. See you next session.', cta: 'See your progress',
  } : {
    kind: 'calm', eyebrow: 'Done for today', title: 'Great session. Now wind down.',
    sub: 'Five minutes of slow breathing helps your body switch from training to recovery.', cta: 'Calm now',
  };
  if (s.focus === 'calm' && !s.calmedToday && !planned) return {
    kind: 'calm', eyebrow: 'For you today', title: 'Five minutes of calm',
    sub: 'Slow breathing, a short recitation and a dua.', cta: 'Calm now',
  };
  if (s.rehab) return {
    kind: 'rehab', eyebrow: `Rehab · phase ${s.rehab.phase + 1} of ${s.rehab.phases}`, title: s.rehab.name,
    sub: planned ? 'Do your rehab first. Your workout is next.' : 'Today\'s exercises, about 15 minutes.', cta: 'Start rehab',
  };
  if (s.focus === 'recover') return {
    kind: 'rehab-start', eyebrow: 'Get started', title: 'Start your recovery plan',
    sub: 'Pick where it hurts. QK checks it\'s safe, then builds a step-by-step plan.', cta: 'Pick where it hurts',
  };
  if (planned) return {
    kind: 'workout', eyebrow: s.readiness === 'adjust' ? 'Today · go a bit lighter' : 'Today\'s workout', title: s.workout.name,
    sub: s.readiness === 'adjust' ? `Do about two-thirds of the sets today. ${s.workout.count} exercises.` : `${s.workout.count} exercises · about ${s.workout.minutes} minutes. QK checks your form.`,
    cta: 'Start workout',
  };
  const nextDay = [1, 2, 3, 4, 5, 6, 7].map(d => (s.weekday + d) % 7).find(d => s.plan.days.includes(d));
  return {
    kind: 'rest', eyebrow: 'Rest day', title: 'Rest is part of the plan',
    sub: `Next workout: ${DAY_NAMES[nextDay]}. A short calm session or a walk is all you need today.`, cta: 'Calm now', secondary: 'Train anyway',
  };
}
