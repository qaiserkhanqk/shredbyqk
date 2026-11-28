// Runs every browser test file of `npm run test:e2e` and `npm run research:e2e` SEPARATELY in the chosen browser,
// so one failing file never hides the others (the npm scripts stop at the first failure).
// Usage: node tools/run-browser-suites.mjs <chromium|firefox|webkit> <log folder>
// Writes one log per file and prints one summary line per file. Exit code 1 if any file failed.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, basename } from 'node:path';
const [browser = 'chromium', dir = 'browser-logs'] = process.argv.slice(2);
mkdirSync(dir, { recursive: true });
const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
const files = name => scripts[name].split('&&').map(x => x.trim()).filter(x => /^node \S+\.cjs$/.test(x)).map(x => x.slice(5));
const env = { ...process.env, E2E_BROWSER: browser };
let bad = 0;
for (const suite of ['test:e2e', 'research:e2e']) for (const f of files(suite)) {
  const r = spawnSync('node', [f], { env, encoding: 'utf8', timeout: 900000 });
  const out = (r.stdout || '') + (r.stderr || ''), log = join(dir, `${browser}-${basename(f, '.cjs')}${f.startsWith('research') ? '-research' : ''}.log`);
  writeFileSync(log, out);
  const ok = (out.match(/^ok /gm) || []).length, fail = (out.match(/^FAIL/gm) || []).length;
  if (r.status !== 0) bad++;
  console.log(`${browser} ${f} exit=${r.status ?? 'timeout'} ok=${ok} fail=${fail}`);
}
process.exit(bad ? 1 : 0);
