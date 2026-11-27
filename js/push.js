// Notifications that reach the phone while the app is closed (Web Push). The phone gives us a push address,
// which is saved on the coach server; a daily job sends check-in reminders and "QK updated your plan".
// Works on Android (Chrome, Edge, Samsung) and on iPhone when the app is added to the Home Screen (iOS 16.4+).
// A namespace import, so an older cloud-config.js without PUSH still loads (push just stays off).
import * as CFG from './cloud-config.js';
const PUSH = CFG.PUSH || {};

export const pushSupported = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof window !== 'undefined' && 'PushManager' in window && !!PUSH.vapidPublicKey;
const key = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));

/** Ask once, subscribe, and save the address. Returns true when the phone will get pushes. */
export async function enablePush(cloud) {
  if (!pushSupported() || !cloud?.signedIn) return false;
  if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(PUSH.vapidPublicKey) }));
  await cloud.savePush(sub);
  return true;
}
