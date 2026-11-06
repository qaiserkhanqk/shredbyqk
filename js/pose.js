// Loads MediaPipe Pose Landmarker once. Runs fully on-device: no video leaves the phone.
import { PoseLandmarker, FilesetResolver } from '../vendor/vision_bundle.mjs';
import { SKELETON } from './angles.js';

let videoLm, imageLm, loading;

async function create(mode) {
  const fileset = await FilesetResolver.forVisionTasks(new URL('../vendor/wasm', import.meta.url).href);
  const opts = (delegate) => ({
    baseOptions: { modelAssetPath: new URL('../models/pose_landmarker_lite.task', import.meta.url).href, delegate },
    runningMode: mode, numPoses: 1,
    minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
  });
  try { return await PoseLandmarker.createFromOptions(fileset, opts('GPU')); }
  catch { return await PoseLandmarker.createFromOptions(fileset, opts('CPU')); }
}

export async function getVideoLandmarker() {
  if (!videoLm) videoLm = await (loading ||= create('VIDEO'));
  return videoLm;
}
export async function getImageLandmarker() {
  if (!imageLm) imageLm = await create('IMAGE');
  return imageLm;
}

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
  ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`;
  for (const l of labels) {
    if (!l.at || Number.isNaN(l.value)) continue;
    const txt = `${Math.round(l.value)}°`;
    const w = ctx.measureText(txt).width + 12;
    ctx.fillStyle = l.bad ? 'rgba(255,77,77,.92)' : 'rgba(10,10,10,.75)';
    ctx.fillRect(l.at.x + 10, l.at.y - fs, w, fs * 1.35);
    ctx.fillStyle = '#fff';
    ctx.fillText(txt, l.at.x + 16, l.at.y + fs * 0.1);
  }
}
