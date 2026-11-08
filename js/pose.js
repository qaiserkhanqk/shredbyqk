// Loads MediaPipe Pose Landmarker. Runs fully on-device: no video leaves the phone.
//
// Three model sizes, same 33 landmarks:
//   lite  (~6 MB)  fastest — live coaching on older phones
//   full  (~9 MB)  more precise — default for live sessions on modern phones
//   heavy (~31 MB) most precise, slowest — used for uploaded videos and tests (gait, jump, knee test),
//                  where accuracy matters more than real-time speed.
import { PoseLandmarker, FilesetResolver } from '../vendor/vision_bundle.mjs';
import { SKELETON } from './angles.js';

const cache = {};
let fileset;

function preferredLiveModel() {
  try { const s = localStorage.getItem('qk_precision'); if (s) return s; } catch {}
  // Heuristic: phones with ≥6 logical cores handle "full" in real time comfortably.
  return (navigator.hardwareConcurrency || 4) >= 6 ? 'full' : 'lite';
}

async function create(mode, model) {
  fileset ||= await FilesetResolver.forVisionTasks(new URL('../vendor/wasm', import.meta.url).href);
  const opts = delegate => ({
    baseOptions: { modelAssetPath: new URL(`../models/pose_landmarker_${model}.task`, import.meta.url).href, delegate },
    runningMode: mode, numPoses: 1,
    minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
  });
  try { return await PoseLandmarker.createFromOptions(fileset, opts('GPU')); }
  catch { return await PoseLandmarker.createFromOptions(fileset, opts('CPU')); }
}

/** @param {'lite'|'full'|'heavy'} [model] defaults to the device-appropriate live model */
export function getVideoLandmarker(model = preferredLiveModel()) {
  const key = 'VIDEO:' + model;
  return (cache[key] ||= create('VIDEO', model).catch(e => { delete cache[key]; throw e; }));
}
export function getImageLandmarker(model = 'heavy') {
  const key = 'IMAGE:' + model;
  return (cache[key] ||= create('IMAGE', model).catch(e => { delete cache[key]; throw e; }));
}
export const liveModelName = () => preferredLiveModel();

export function drawPose(ctx, px, opts = {}) {
  const { good = '#c6ff3d', color = good, labels = [] } = opts;
  ctx.lineWidth = Math.max(3, ctx.canvas.width / 220);
  ctx.strokeStyle = color; ctx.lineCap = 'round';
  for (const [a, b] of SKELETON) {
    if (px[a].v < 0.4 || px[b].v < 0.4) continue;
    ctx.beginPath(); ctx.moveTo(px[a].x, px[a].y); ctx.lineTo(px[b].x, px[b].y); ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  for (let i = 11; i < 33; i++) {
    if (px[i].v < 0.4) continue;
    ctx.beginPath(); ctx.arc(px[i].x, px[i].y, ctx.lineWidth * 1.3, 0, Math.PI * 2); ctx.fill();
  }
  const fs = Math.max(14, ctx.canvas.width / 40);
  ctx.font = `700 ${fs}px "IBM Plex Mono", ui-monospace, monospace`;
  for (const l of labels) {
    if (!l.at || l.value == null || Number.isNaN(l.value)) continue;
    const txt = l.text ?? `${Math.round(l.value)}°`;
    const w = ctx.measureText(txt).width + 12;
    ctx.fillStyle = l.bad ? 'rgba(255,90,95,.92)' : 'rgba(10,13,20,.78)';
    ctx.fillRect(l.at.x + 10, l.at.y - fs, w, fs * 1.35);
    ctx.fillStyle = '#fff';
    ctx.fillText(txt, l.at.x + 16, l.at.y + fs * 0.1);
  }
}
