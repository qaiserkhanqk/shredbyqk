// "Was QK right?": every camera set can be confirmed or corrected in one tap. Each answer is a label (numbers only:
// which exercise, what QK counted, the corrected count, which cue it gave, the camera view and how clearly it saw
// the joints). Together they measure QK's real-world accuracy: rep counting, and how often each cue is right.
// That is the evidence the thresholds get tuned on (SCIENCE.md "Camera accuracy"). Pure, unit tested.

/** One label from a finished set. verdict: 'right' | 'count' | 'cue'. */
export function makeLabel({ at = Date.now(), ex, counted, reps, cue = null, verdict, view = null, vis = null, unsure = 0, model = null }) {
  return { at, ex, counted, reps: reps ?? counted, cue, verdict, view, vis: vis == null ? null : Math.round(vis * 100) / 100, unsure, model };
}

/** Add or update the label for a set (one per set, keyed by its time). Keeps the last 500. */
export function saveLabel(S, label) {
  S.labels ||= [];
  const i = S.labels.findIndex(l => l.at === label.at);
  if (i >= 0) S.labels[i] = { ...S.labels[i], ...label }; else S.labels.push(label);
  if (S.labels.length > 500) S.labels.splice(0, S.labels.length - 500);
  return S.labels;
}

/**
 * Accuracy from labels (one client's or everyone's).
 * countExact: sets where QK's count needed no correction; countWithin1: off by at most one rep;
 * repError: mean absolute reps off per set; cues: per cue id, how often it was confirmed vs called wrong.
 */
export function accuracy(labels = []) {
  const L = labels.filter(l => l && l.counted != null);
  if (!L.length) return null;
  const off = L.map(l => Math.abs((l.reps ?? l.counted) - l.counted));
  const cueL = L.filter(l => l.cue);
  const cues = {};
  for (const l of cueL) {
    const c = (cues[l.cue] ||= { id: l.cue, n: 0, wrong: 0 });
    c.n++; if (l.verdict === 'cue') c.wrong++;
  }
  const byEx = {};
  for (const l of L) { const e = (byEx[l.ex] ||= { ex: l.ex, n: 0, exact: 0 }); e.n++; if ((l.reps ?? l.counted) === l.counted) e.exact++; }
  const pct = (a, b) => (b ? Math.round(a / b * 100) : null);
  return {
    sets: L.length,
    countExact: pct(off.filter(x => x === 0).length, L.length),
    countWithin1: pct(off.filter(x => x <= 1).length, L.length),
    repError: Math.round(off.reduce((a, b) => a + b, 0) / L.length * 100) / 100,
    cueRight: pct(cueL.filter(l => l.verdict !== 'cue').length, cueL.length),
    cues: Object.values(cues).map(c => ({ ...c, wrongPct: pct(c.wrong, c.n) })).sort((a, b) => b.wrongPct - a.wrongPct || b.n - a.n),
    byExercise: Object.values(byEx).map(e => ({ ...e, exactPct: pct(e.exact, e.n) })).sort((a, b) => a.exactPct - b.exactPct),
    unclearShare: pct(L.filter(l => l.unsure > 0).length, L.length),
  };
}

/** Cues worth retuning: called wrong on at least 30% of 5+ sets. */
export const needsTuning = acc => (acc?.cues || []).filter(c => c.n >= 5 && c.wrongPct >= 30);

/** Before a set: is the phone placed so QK can see properly? px = pixel landmarks, w/h = frame size. */
export function setupCheck({ px, w, h, view, wantView, fps }) {
  const issues = [];
  if (wantView && wantView !== 'either' && view && view !== wantView) issues.push({ id: 'view', say: wantView === 'side' ? 'Turn side-on to the camera.' : 'Face the camera.' });
  const ys = [0, 27, 28].map(i => px[i]?.y).filter(Number.isFinite), xs = [11, 12, 23, 24, 27, 28].map(i => px[i]?.x).filter(Number.isFinite);
  if (ys.length === 3 && (Math.min(...ys) < h * 0.02 || Math.max(...ys) > h * 0.98)) issues.push({ id: 'frame', say: 'Move the phone back so your head and feet are both in view.' });
  else if (xs.length && (Math.min(...xs) < w * 0.03 || Math.max(...xs) > w * 0.97)) issues.push({ id: 'frame', say: 'Step to the middle of the picture.' });
  const body = ys.length === 3 ? Math.max(...ys) - Math.min(...ys) : null;
  if (body != null && body < h * 0.35) issues.push({ id: 'far', say: 'Come a bit closer to the phone. You look small to me.' });
  if (fps && fps < 20) issues.push({ id: 'fps', say: 'The camera is running slowly. More light helps, or close other apps.' });
  return { ok: !issues.length, issues };
}
