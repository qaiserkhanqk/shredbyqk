#!/usr/bin/env node
// Makes N test clients in a STAGING Supabase project and prints their sign-in tokens (for tests/load/sync.k6.js).
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… SUPABASE_ANON_KEY=… node tools/load-users.mjs 5000 > tests/load/tokens.json
// Never run this against your live project. Delete the users afterwards (Authentication → Users, filter "loadtest").
const n = +process.argv[2] || 100, U = process.env.SUPABASE_URL?.replace(/\/$/, ''), S = process.env.SUPABASE_SERVICE_ROLE_KEY, A = process.env.SUPABASE_ANON_KEY;
if (!U || !S || !A) { console.error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY (staging project).'); process.exit(1); }
const out = [], pw = 'Load-' + Math.random().toString(36).slice(2) + '!9';
for (let i = 0; i < n; i += 20) {
  await Promise.all(Array.from({ length: Math.min(20, n - i) }, async (_, k) => {
    const email = `loadtest+${i + k}@example.com`;
    await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: { apikey: S, authorization: `Bearer ${S}`, 'content-type': 'application/json' }, body: JSON.stringify({ email, password: pw, email_confirm: true }) });
    const r = await fetch(`${U}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: A, 'content-type': 'application/json' }, body: JSON.stringify({ email, password: pw }) });
    const j = await r.json(); if (j.access_token) out.push({ id: j.user.id, access_token: j.access_token });
  }));
  process.stderr.write(`\r${out.length}/${n}`);
}
console.log(JSON.stringify(out));
