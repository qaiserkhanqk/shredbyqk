// Decides WHAT the coach says after each rep and WHEN to stay quiet.
// Motor-learning principles applied (references in SCIENCE.md):
//  1. One cue at a time, highest priority (safety > effectiveness > refinement).
//  2. Faded / bandwidth feedback (Winstein & Schmidt 1990; guidance hypothesis):
//     cueing every single rep creates dependence and worse retention. A fault is cued the first
//     time, then only if it persists for 2 reps in a row, and at most 3 times per set.
//     Safety faults (priority 1) are exempt from fading.
//  3. Positive feedback after good trials (Chiviacowsky & Wulf 2007): when a cued fault is
//     corrected, praise that specific fix right away — it locks in the new pattern.
//  4. Self-controlled feedback (Chiviacowsky & Wulf 2002): the lifter can tap the coach to ask
//     "how was that?" — learners who choose when to get feedback retain skills better.
//  5. Fatigue/tempo from velocity loss — stop the set on quality, not just a rep number.
import { countWord, praise } from './coach.js';

export class FeedbackCoach {
  constructor() {
    this.cuedCount = {}; this.lastCuedRep = {}; this.streak = {}; this.awaitingFix = null;
    this.saidFatigue = 0; this.fastEcc = 0; this.lastSummary = null;
  }

  // Returns { text, id, priority } or null.
  onRep(ev) {
    const { faults, reps, tempo, vl } = ev;
    // Track consecutive occurrences per fault.
    const ids = new Set(faults.map(f => f.id));
    for (const id of Object.keys(this.streak)) if (!ids.has(id)) this.streak[id] = 0;
    for (const id of ids) this.streak[id] = (this.streak[id] || 0) + 1;

    // 3. Corrected a fault we just cued? Specific praise beats a generic count.
    if (this.awaitingFix && !ids.has(this.awaitingFix.id)) {
      const r = this.awaitingFix; this.awaitingFix = null;
      this.lastSummary = r.yes;
      return { text: `${countWord(reps)}. ${r.yes}`, id: `yes_${r.id}`, priority: 'high' };
    }

    // 5. Fatigue first: velocity loss over ~40% = grinding reps, where form breaks down.
    if (vl >= 0.4 && this.saidFatigue < 2) {
      this.saidFatigue = 2;
      return { text: 'Your reps have slowed right down. That\'s a great place to end the set. Quality over quantity.', id: 'vl40', priority: 'high' };
    }
    if (vl >= 0.25 && this.saidFatigue < 1) {
      this.saidFatigue = 1;
      return { text: `${countWord(reps)}. It\'s getting hard now. Two more strong reps.`, id: 'vl25', priority: 'high' };
    }

    // 1 + 2. Pick one fault that passes the fading schedule.
    for (const f of faults) {
      const n = this.cuedCount[f.id] || 0;
      const safety = f.priority === 1;
      const due = n === 0 || (this.streak[f.id] >= 2 && reps - (this.lastCuedRep[f.id] || 0) >= 2);
      if ((safety || n < 3) && due) {
        this.cuedCount[f.id] = n + 1; this.lastCuedRep[f.id] = reps; this.streak[f.id] = 0;
        this.awaitingFix = f; this.lastSummary = f.cue;
        return { text: f.cue, id: f.id, priority: 'high' };
      }
    }

    // Tempo: a dropped eccentric (<0.6 s) twice running loses control and time under tension.
    if (tempo && tempo.ecc > 0 && tempo.ecc < 0.6) {
      if (++this.fastEcc === 2) { this.lastSummary = 'Control the way down.'; return { text: 'Control the way down. Take two seconds.', id: 'tempo_ecc', priority: 'high' }; }
    } else this.fastEcc = 0;

    if (!faults.length) {
      this.lastSummary = 'That rep was clean.';
      // Plain counts carry an id (n1…n20) so QK's own recorded voice is used when it exists.
      return reps % 3 === 0 ? { text: `${countWord(reps)}. ${praise()}`, priority: 'low' } : { text: countWord(reps), id: reps <= 20 ? `n${reps}` : undefined, priority: 'low' };
    }
    return { text: countWord(reps), id: reps <= 20 ? `n${reps}` : undefined, priority: 'low' };
  }

  onContinuousFault(f) {
    const n = this.cuedCount[f.id] || 0;
    if (f.priority !== 1 && n >= 3) return null;
    this.cuedCount[f.id] = n + 1; this.awaitingFix = f; this.lastSummary = f.cue;
    return { text: f.cue, id: f.id, priority: 'high' };
  }

  // 4. Learner asked for feedback.
  onRequest() {
    return { text: this.lastSummary || 'Do a couple of reps and ask me again.', id: 'ask_' + Date.now(), priority: 'high' };
  }
}

// Rest between sets from the goal and how hard the set was (Schoenfeld 2016: ≥2 min supports
// hypertrophy for compound lifts; closer to failure → more recovery needed).
export function restSeconds(exKey, vl) {
  const compound = ['squat', 'hipThrust', 'rdl', 'lunge', 'press', 'bench', 'row', 'vPull', 'dip'].includes(exKey);
  let s = compound ? 120 : 75;
  if (vl >= 0.3) s += 45;
  return s;
}
