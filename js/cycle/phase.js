// Optional phase education (flag phaseEducation, default OFF).
//
// What it will and won't say:
//   • During bleeding the user logged: "Menstruation", marked OBSERVED, and explained as the first part of
//     the follicular phase.
//   • Only when the research temperature flag is on AND a sustained rise was found retrospectively in this
//     cycle: "possibly after ovulation", marked ESTIMATE, with the caveat that it is not proof.
//   • Otherwise: an explicit NOT ENOUGH DATA state. Dates alone can't show when ovulation happened, so no
//     phase is guessed: no "day 14", no count-back from the next period.
//   • Never shown with hormonal contraception, pregnancy, postpartum or breastfeeding, perimenopause, or
//     another condition the user flagged.
// No phase is ever labelled "confirmed", and no training or nutrition prescription is attached to a phase.
import { periodOn, observedBleeding, SITUATIONS } from './model.js';

export const PHASE_EDUCATION = 'Cycles are often described in four phases (menstruation, follicular, ovulation, luteal). That is a simplification: menstruation is the start of the follicular phase, timing differs between people and from cycle to cycle, and it can only be pinned down with tests such as hormone measurements or ultrasound.';

export function phaseInfo(s, today, { tempShift = null } = {}) {
  const blocked = Object.keys(s.situation || {}).filter(k => s.situation[k]);
  if (blocked.length) return { status: 'unsupported', label: 'Not shown', text: `Phase information isn't shown because you told us: ${blocked.map(k => SITUATIONS[k].label.toLowerCase()).join(', ')}. The usual phase description doesn't apply reliably.` };
  if (!s.periods.length) return { status: 'not_enough_data', label: 'Not enough data', text: 'Log a period to see when menstruation was observed.' };
  const bleed = observedBleeding(s, today);
  if (bleed === 'period') return { status: 'observed', label: 'Menstruation', text: 'From your log. Menstruation is the first part of the follicular phase.' };
  if (bleed === 'spotting' || bleed === 'none') return { status: 'not_enough_data', label: 'Not enough data', text: `You logged ${bleed === 'none' ? 'no bleeding' : 'spotting'} today, so this isn't shown as menstruation. Dates alone can't show which phase you're in.` };
  const open = periodOn(s, today, today);
  if (open && !open.end) return { status: 'not_enough_data', label: 'Not enough data', text: `Your period started on ${open.start} and no end or bleeding is logged for today, so we don't assume you're still bleeding.` };
  if (tempShift?.detected) return { status: 'estimate', label: 'Possibly after ovulation (estimate)', text: `A sustained rise in wrist skin temperature was seen from ${tempShift.firstHighNight}. That can be consistent with ovulation having already happened, but it is not proof and it was only visible afterwards.` };
  return { status: 'not_enough_data', label: 'Not enough data', text: 'Dates alone can\'t show when ovulation happens, so we don\'t estimate which phase you\'re in.' };
}
