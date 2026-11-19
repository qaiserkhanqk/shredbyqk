// Reproducible local demo with SYNTHETIC data. Creates a fresh demo database, a researcher account with a random
// password (printed once, here, on your own terminal), three synthetic participants, and starts the server on
// 127.0.0.1. Experimental analysis stays OFF until you switch it on in the dashboard.
// The demo database is encrypted with a random key that exists only in this process (the database is recreated on
// every run). Two-factor sign-in is NOT enforced in the demo, so you can sign in with the printed password; a real
// instance (npm run research:start) requires it for admins and researchers.
//   npm run research:demo            (or: node research/tools/demo.mjs --port 8787)
import { rmSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { generateKey } from '../server/keys.js';
import { openStore } from '../server/store.js';
import { start, settingsFromEnv } from '../server/server.js';
import { seedDemo } from './seed.mjs';
import { LABEL } from '../lib/policy.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data'), db = join(dir, 'demo.sqlite'), ledgerPath = join(dir, 'demo-deletion-ledger.jsonl');
mkdirSync(dir, { recursive: true });
for (const f of [db, `${db}-wal`, `${db}-shm`, ledgerPath]) rmSync(f, { force: true });
const dbKey = generateKey(); // in memory only: the demo database cannot be opened after this process ends
const store = openStore(db, { key: dbKey, ledgerPath }), password = randomBytes(12).toString('base64url');
const rid = store.createUser({ username: 'researcher', password, role: 'researcher' });
seedDemo(store, { researcherId: rid });
store.close();
const i = process.argv.indexOf('--port'), settings = { ...settingsFromEnv(), db, dbKey, ledgerPath, requireMfaRoles: [], port: i > 0 ? Number(process.argv[i + 1]) : 8787 };
const { port } = await start(settings);
console.log(`\n${LABEL}\nSynthetic demo running at http://127.0.0.1:${port}/\n  username: researcher\n  password: ${password}\nTwo-factor sign-in is not enforced in this synthetic demo (it is for admins and researchers on a real instance).\nStop with Ctrl+C. The demo database is research/data/demo.sqlite (git-ignored, encrypted with a key that is discarded when the demo stops).\n`);
