// Account management for a local deployment. The password is read from RESEARCH_NEW_PASSWORD (never a command-line
// argument, which would land in shell history). Example:
//   RESEARCH_NEW_PASSWORD='…' node research/server/cli.mjs create-user --role admin --username admin
import { openStore } from './store.js';
import { settingsFromEnv } from './server.js';

const arg = k => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const [cmd] = process.argv.slice(2);
if (cmd !== 'create-user') { console.error('usage: RESEARCH_NEW_PASSWORD=… node research/server/cli.mjs create-user --role admin|researcher --username NAME'); process.exit(2); }
const pw = process.env.RESEARCH_NEW_PASSWORD;
if (!pw) { console.error('Set RESEARCH_NEW_PASSWORD (at least 12 characters).'); process.exit(2); }
const store = openStore(settingsFromEnv().db);
try { const id = store.createUser({ username: arg('username'), password: pw, role: arg('role') }); store.audit(null, 'user_created_cli', null); console.log(`created user ${id}`); }
catch (e) { console.error(e.code || e.message); process.exit(1); }
