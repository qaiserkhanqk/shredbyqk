// Replay an exported session through the same analysis code the app runs.
//
// Usage:  node tests/replay.mjs path/to/session.json [--trace]
// The app's diagnostics panel exports these files (landmarks only, no video).
// --trace prints the state machine frame by frame, which is how a "missed rep" is debugged.
import fs from 'node:fs';
import { framesFromSession } from '../js/diagnostics.js';
import { analyseGait } from '../js/gait.js';
import { analyseJumps } from '../js/jump.js';
import { analyseSingleLegSquat } from '../js/kneetest.js';
import { RepEngine } from '../js/exercises.js';
import { exFor } from '../js/library.js';
import { viewOf, Smoother } from '../js/angles.js';

export function replay(json, { trace = false } = {}) {
  const frames = framesFromSession(json), m = json.meta || {};
  if (m.kind === 'gait') return analyseGait(frames, { mode: m.gaitMode || 'walk' });
  if (m.kind === 'jump') return analyseJumps(frames, { mPerPx: m.mPerPx || null });
  if (m.kind === 'sls') return analyseSingleLegSquat(frames);
  if (m.kind === 'form') {
    const ex = exFor(m.exercise); if (!ex) throw new Error('Unknown exercise ' + m.exercise);
    const sm = new Smoother(0.55); let eng = null; const reps = [];
    for (const f of frames) {
      if (!eng) eng = new RepEngine(ex, ex.view === 'either' ? viewOf(f.px) : ex.view);
      const raw = ex.metrics(f.px, eng.view), mm = { ...raw };
      for (const k of ['knee', 'hip', 'elbow', 'torsoLean']) if (raw[k] != null) mm[k] = sm.push(k, raw[k]);
      if (raw.s.conf < 0.55) continue;
      for (const ev of eng.update(mm, f.t)) {
        if (ev.type === 'rep') reps.push({ rep: ev.reps, faults: ev.faults.map(x => x.id), rom: Math.round(ev.rom) });
        if (trace) console.log(`t=${(f.t / 1000).toFixed(2)}s rep ${ev.reps ?? ''} ${ev.type} ${ev.faults.map(x => x.id).join(',')}`);
      }
      if (trace) console.log(`t=${(f.t / 1000).toFixed(2)}s ${ex.primary}=${mm[ex.primary]?.toFixed(1)} phase=${eng.phase}`);
    }
    return { reps: reps.length, detail: reps, clean: eng?.goodReps ?? 0 };
  }
  throw new Error('Unknown session kind: ' + m.kind);
}

if (process.argv[1] && process.argv[1].endsWith('replay.mjs') && process.argv[2]) {
  const json = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const res = replay(json, { trace: process.argv.includes('--trace') });
  console.log('Session:', json.meta?.kind, json.meta?.exercise || '', '| app', json.meta?.app, '|', json.frames.length, 'frames');
  console.log('Recorded result:', JSON.stringify(json.meta?.result ?? null));
  console.log('Replayed result:', JSON.stringify(res, null, 1));
}
