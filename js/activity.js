// Daily activity: step counts from the phone's health app (native app), or typed in on the web.
// Used by QK's weekly report and to suggest the "How active" setting for the calorie target.
const nativeSteps = () => globalThis.Capacitor?.isNativePlatform?.() && globalThis.Capacitor.Plugins?.Steps;
export const canSyncSteps = () => !!nativeSteps();

/** Pull the last `days` of steps into store ({ "2026-11-20": 8421 }). Returns how many days came back. */
export async function syncSteps(store, days = 14) {
  const P = nativeSteps(); if (!P) return 0;
  const r = await P.dailySteps({ days });
  for (const d of r?.days || []) if (d.steps >= 0) store[d.date] = Math.round(d.steps);
  return r?.days?.length || 0;
}

/** Average steps over the given day keys that have a count, or null. */
export function avgSteps(store, keys) {
  const v = keys.map(k => store?.[k]).filter(n => n > 0);
  return v.length >= 3 ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
}

/**
 * Activity level from steps plus training days (Tudor-Locke step bands: <5,000 sedentary, 7,500–10,000
 * somewhat active to active, >10,000 active). Training 4+ days moves you up a level.
 */
export function activityFromSteps(avg, trainingDays = 0) {
  if (avg == null) return null;
  let lvl = avg < 5000 ? 0 : avg < 10000 ? 1 : 2;
  if (trainingDays >= 4) lvl = Math.min(2, lvl + 1);
  return ['low', 'mid', 'high'][lvl];
}
