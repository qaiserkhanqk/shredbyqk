// Studio: QK records his own voice for every fixed coaching line, inside the app.
//
// Pipeline (zero cost):
//   1. Studio screen lists every recordable cue with its text. Tap record, speak, save.
//   2. Clips are stored on this phone (IndexedDB), so QK hears his own voice immediately.
//   3. "Export recordings" saves one JSON file. On a computer:
//        node tools/import-cues.mjs shred-voice.json
//      writes audio/cues/<id>.<ext> + manifest.json. Push to GitHub and every client hears QK's real voice.
// Lines with live numbers ("Set done. 10 reps, 7 clean") stay synthetic: they can't be pre-recorded.
import { EXERCISES, allRules } from './exercises.js';

const FIXED = [
  ['not_visible', 'I can\'t see you. Step back so your whole body is in the frame.'],
  ['wrong_view', 'Turn side-on to the camera for this one.'],
  ['ask_none', 'Do a couple of reps and ask me again.'],
  ['vl25', 'It\'s getting hard now. Two more strong reps.'],
  ['vl40', 'Your reps have slowed right down. That\'s a great place to end the set. Quality over quantity.'],
  ['tempo_ecc', 'Control the way down. Take two seconds.'],
  ['rest10', 'Ten seconds. Get set up.'],
  ['rest0', 'Rest over. Let\'s go again.'],
  ['hold_go', 'Go. Hold it.'],
  ['hold_half', 'Halfway. Breathe.'],
  ['hold_10', 'Ten seconds left.'],
  ['checkin', 'Logged. Keep showing up.'],
  ['greet', 'Right, let\'s get to work.'],
  ['praise1', 'Good rep.'], ['praise2', 'That\'s it.'], ['praise3', 'Perfect, keep going.'], ['praise4', 'Strong.'], ['praise5', 'Lovely, same again.'],
  ...Array.from({ length: 20 }, (_, i) => [`n${i + 1}`, ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'][i]]),
];

/** Every recordable line: fixed phrases, rep counts, and each form correction plus its praise. */
export function cueList() {
  const seen = new Set(), out = [];
  const add = (id, text, group) => { if (!seen.has(id)) { seen.add(id); out.push({ id, text, group }); } };
  FIXED.forEach(([id, t]) => add(id, t, /^n\d+$/.test(id) ? 'Rep counts' : /^praise/.test(id) ? 'Praise' : 'Coaching'));
  for (const [key, ex] of Object.entries(EXERCISES)) for (const r of allRules(ex)) { add(r.id, r.cue, ex.name); if (r.yes) add('yes_' + r.id, r.yes, ex.name); }
  return out;
}

// ---------- local storage of clips (IndexedDB) ----------
const DB = 'shred-studio', STORE = 'cues';
function db() {
  return new Promise((res, rej) => {
    if (!('indexedDB' in globalThis)) return rej(new Error('no indexedDB'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(STORE, mode), s = t.objectStore(STORE); const q = fn(s); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); }); };
export const saveClip = (id, blob) => tx('readwrite', s => s.put(blob, id));
export const getClip = id => tx('readonly', s => s.get(id)).catch(() => null);
export const deleteClip = id => tx('readwrite', s => s.delete(id));
export const listClipIds = () => tx('readonly', s => s.getAllKeys()).catch(() => []);

/** Record from the microphone until stop() is called. */
export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const rec = new MediaRecorder(stream), chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.start();
  return {
    stop: () => new Promise(res => { rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); res(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })); }; rec.stop(); }),
  };
}

/** One JSON file containing every clip (base64) — imported with tools/import-cues.mjs. */
export async function exportClips() {
  const ids = await listClipIds(), clips = {};
  for (const id of ids) {
    const b = await getClip(id); if (!b) continue;
    const buf = new Uint8Array(await b.arrayBuffer()); let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    clips[id] = { type: b.type, data: btoa(bin) };
  }
  return { format: 'shred-voice-1', exportedAt: new Date().toISOString(), clips };
}
