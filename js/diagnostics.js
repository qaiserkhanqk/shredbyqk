// Diagnostics: how problems get found and fixed.
//
// 1. SessionRecorder keeps the landmarks of the last session (not the video — no images, small, private).
//    A client or coach can export it as JSON when something looks wrong ("it missed my 3rd rep").
// 2. That file is replayed offline with `node tests/replay.mjs session.json`, which re-runs the exact
//    same analysis code and prints what happened frame by frame. The bug is reproducible.
// 3. Once fixed, the file goes into tests/fixtures/ with the correct answer, so it can never come back.
// 4. ErrorLog captures crashes on the device so they can be included in a report.

export const APP_VERSION = '1.3.0';
const LOG_KEY = 'shred_errors_v1';

export class SessionRecorder {
  constructor(maxFrames = 3600) { this.max = maxFrames; this.clear(); }
  clear() { this.frames = []; this.meta = {}; }
  start(meta) { this.clear(); this.meta = { app: APP_VERSION, startedAt: new Date().toISOString(), ua: navigator.userAgent, ...meta }; }
  /** Stores pixel landmarks rounded to 0.1 px — plenty for analysis, ~40% smaller. */
  push(t, px) {
    if (this.frames.length >= this.max) return;
    this.frames.push({ t: Math.round(t * 10) / 10, p: px.map(q => [Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10, Math.round((q.v ?? 1) * 100) / 100]) });
  }
  finish(result) { this.meta.result = result; this.meta.endedAt = new Date().toISOString(); }
  toJSON() { return { meta: this.meta, frames: this.frames }; }
  get length() { return this.frames.length; }
}

/** Convert an exported session back into the {t, px} frames every analyser takes. */
export function framesFromSession(json) {
  return json.frames.map(f => ({ t: f.t, px: f.p.map(([x, y, v]) => ({ x, y, v })) }));
}

export const ErrorLog = {
  read() { try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch { return []; } },
  add(entry) {
    try {
      const log = ErrorLog.read(); log.push({ at: new Date().toISOString(), app: APP_VERSION, ...entry });
      localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(-50)));
    } catch { /* storage full or blocked: never let logging crash the app */ }
  },
  clear() { try { localStorage.removeItem(LOG_KEY); } catch {} },
  install() {
    window.addEventListener('error', e => ErrorLog.add({ type: 'error', message: e.message, where: `${e.filename}:${e.lineno}:${e.colno}` }));
    window.addEventListener('unhandledrejection', e => ErrorLog.add({ type: 'promise', message: String(e.reason?.message || e.reason) }));
  },
};

/** Save a JSON file to the device (works on the hosted app; some embedded viewers block downloads). */
export function downloadJSON(name, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}
