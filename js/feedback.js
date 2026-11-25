// Decides WHAT the coach says after each rep and WHEN to stay quiet.
// Motor-learning principles applied (references in SCIENCE.md):
//  1. One cue at a time, highest priority (safety > effectiveness > refinement).
//  2. Immediate, like a coach beside you: faults that can be seen mid-rep are called out the
//     moment they appear (interrupting other speech); the rest right after the rep. After two
//     full cues QK switches to the short shout ("Knees out!"), so feedback stays quick and gets
//     less wordy as the lifter learns it (a light form of faded feedback, Winstein & Schmidt 1990).
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
    this.liveTimes = {};
  }

  /**
   * A fault seen mid-rep. Said immediately, interrupting whatever QK is saying, like a coach
   * standing next to you. The first two times use the full cue; after that QK uses the short
   * coach's shout ("Knees out!"), because the lifter already knows what it means and a short cue
   * lands before the rep is over.
   */
  onLive(f) {
    const n = this.liveTimes[f.id] = (this.liveTimes[f.id] || 0) + 1;
    this.cuedCount[f.id] = (this.cuedCount[f.id] || 0) + 1;
    this.awaitingFix = f; this.lastSummary = f.cue;
    const short = n > 2 && f.tag;
    return { text: short ? f.tag + '!' : f.cue, id: short ? f.id + '_short' : f.id, priority: 'now', live: true };
  }

  // Returns { text, id, priority } or null.
  onRep(ev) {
    const { reps, tempo, vl } = ev;
    // Faults already called out live during this rep aren't repeated at the end of it.
    const faults = ev.faults.filter(f => !(ev.live || []).includes(f.id));
    // Track consecutive occurrences per fault.
    const ids = new Set(ev.faults.map(f => f.id));
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

    // 1. Coach-style: every faulty rep gets corrected straight away, highest priority first
    //    (full cue the first two times, then the short shout).
    if (faults.length) return this.onLive(faults[0]);

    // Tempo: a dropped eccentric (<0.6 s) twice running loses control and time under tension.
    if (tempo && tempo.ecc > 0 && tempo.ecc < 0.6) {
      if (++this.fastEcc === 2) { this.lastSummary = 'Control the way down.'; return { text: 'Control the way down. Take two seconds.', id: 'tempo_ecc', priority: 'high' }; }
    } else this.fastEcc = 0;

    if (!ev.faults.length) {
      this.lastSummary = 'That rep was clean.';
      // Plain counts carry an id (n1…n20) so QK's own recorded voice is used when it exists.
      return reps % 3 === 0 ? { text: `${countWord(reps)}. ${praise()}`, priority: 'low' } : { text: countWord(reps), id: reps <= 20 ? `n${reps}` : undefined, priority: 'low' };
    }
    return { text: countWord(reps), id: reps <= 20 ? `n${reps}` : undefined, priority: 'low' };
  }

  onContinuousFault(f) { return this.onLive(f); }

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
