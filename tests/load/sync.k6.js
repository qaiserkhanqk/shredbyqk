// k6 load test: every phone syncing to Supabase (a STAGING project, never your live one).
// First make test users:  SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… SUPABASE_ANON_KEY=… node tools/load-users.mjs 5000 > tests/load/tokens.json
//   k6 run -e URL=https://staging.supabase.co -e ANON=<anon key> tests/load/sync.k6.js
import http from 'k6/http';
import { check, sleep } from 'k6';
const tokens = JSON.parse(open('./tokens.json'));
export const options = {
  scenarios: { everyone_open: { executor: 'ramping-vus', stages: [{ duration: '1m', target: tokens.length }, { duration: '5m', target: tokens.length }, { duration: '30s', target: 0 }] } },
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<1500'] },
};
export default function () {
  const t = tokens[(__VU - 1) % tokens.length], day = new Date().toISOString().slice(0, 10);
  const h = { headers: { apikey: __ENV.ANON, authorization: `Bearer ${t.access_token}`, 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' } };
  const a = http.post(`${__ENV.URL}/rest/v1/food_days?on_conflict=client_id,at`, JSON.stringify([{ client_id: t.id, at: day, kcal: 1900, protein: 130, carbs: 210, fat: 60, water: 7, steps: 8000, items: [] }]), h);
  const b = http.patch(`${__ENV.URL}/rest/v1/profiles?id=eq.${t.id}`, JSON.stringify({ last_seen: new Date().toISOString() }), h);
  const c = http.get(`${__ENV.URL}/rest/v1/messages?client_id=eq.${t.id}&read_at=is.null&select=id`, h);
  check(a, { 'food synced': r => r.status < 300 }); check(b, { 'profile updated': r => r.status < 300 }); check(c, { 'messages read': r => r.status === 200 });
  sleep(300); // the app syncs every 5 minutes
}
