// Coach dashboard server (Supabase). Paste your project's values here (Supabase → Project Settings → API).
// The anon key is meant to be public: every request is still limited by the privacy rules in
// supabase/schema.sql, so a client can only reach their own data and a coach only their clients'.
// Leave both empty and the app works exactly as before (everything stays on the phone), and the
// dashboard runs with sample clients.
export const CLOUD = {
  url: '',      // e.g. 'https://abcdefgh.supabase.co'
  anonKey: '',  // the "anon public" key
};
export const cloudOn = () => !!(CLOUD.url && CLOUD.anonKey);
// Notifications to a closed app: the VAPID public key from `node tools/webpush.mjs keys` (the private key
// goes in the GitHub Actions secrets, never here). Leave empty and the app uses in-app reminders only.
export const PUSH = {
  vapidPublicKey: '',
};
// Chat with QK: where the app asks Muhammad (QK's AI assistant) to answer, e.g. 'https://your-server/chat'.
// Empty: the app uses the photo server's address with /chat; with neither, replies come from
// `node tools/chat-assistant.mjs --watch` (see supabase/README.md).
export const CHAT = {
  endpoint: '',
};
