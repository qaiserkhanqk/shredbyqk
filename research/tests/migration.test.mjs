// Upgrading a database created by the previous version (schema 1, commit f67000b) to schema 2: batches become one row
// per attempt (explicit reimports), and annotations/quarantine gain `canonical_type`, filled from the stored type.
// Synthetic data only. Run: node research/tests/migration.test.mjs
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore, SCHEMA_VERSION } from '../server/store.js';
import { preview, annotationHash } from '../lib/ingest.js';
import { check, done } from './harness.mjs';

const dir = mkdtempSync(join(tmpdir(), 'rs-migrate-')), db = join(dir, 'v1.sqlite');
// The schema-1 store exactly as committed in f67000b, kept as a frozen fixture so this test also runs outside a git
// checkout (e.g. from the review ZIP). It imports only Node built-ins.
const { openStore: openV1 } = await import('./fixtures/store-v1-f67000b.mjs');

// Guard: the fixture must still equal f67000b's store when a git checkout is available (skipped, and said so, without one).
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
let fixtureMatches = true;
try {
  const orig = execFileSync('git', ['-C', fileURLToPath(new URL('../..', import.meta.url)), 'show', 'f67000b:research/server/store.js'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  fixtureMatches = readFileSync(fileURLToPath(new URL('./fixtures/store-v1-f67000b.mjs', import.meta.url)), 'utf8').split('\n').slice(2).join('\n') === orig;
} catch { console.log('note: no git checkout here, so the fixture-vs-f67000b comparison is skipped'); }
const ref = 'P-MIG-0001', HEAD = 'participant_ref,entry_id,type,value,date,recorded_at,corrects';
const old = openV1(db);
const pid = old.createParticipant({ ref, adultConfirmed: true }, null);
for (const scope of ['core_research', 'lh_tests']) old.setConsent(pid, scope, true, null);
const text = [HEAD, `${ref},${ref}-b1,bleeding,period_start,2026-01-05,2026-01-05T09:00:00Z,`, `${ref},${ref}-l1,lh_test,positive,2026-01-18,2026-01-18T09:00:00Z,`, `${ref},${ref}-l2, lh_test ,negative,2026-13-40,2026-01-19T09:00:00Z,`].join('\n');
const pv = preview(text, { format: 'csv', recordType: 'annotations', participantRef: ref, consents: { core_research: true, lh_tests: true } });
old.commitImport(pid, pv, null, annotationHash);
const before = { batches: old.db.prepare('SELECT id FROM batches').all().map(r => r.id), ann: old.db.prepare('SELECT id, batch_id FROM annotations').all().length, q: old.db.prepare('SELECT raw_json FROM quarantine').all() };
old.close();
check('setup: the frozen fixture is the f67000b store byte for byte (apart from its 2-line header)', fixtureMatches);
check('setup: the schema-1 database holds a batch, 2 annotations and a quarantined LH row typed " lh_test "', before.batches.length === 1 && before.ann === 2 && before.q.some(r => JSON.parse(r.raw_json)?.type === ' lh_test '));

const s = openStore(db);
const cols = t => s.db.prepare(`SELECT name FROM pragma_table_info('${t}')`).all().map(r => r.name);
check('migration: schema version recorded as the current version (3 since the 21317c5 fixes; was 2)', s.db.prepare("SELECT v FROM meta WHERE k = 'schema_version'").get().v === String(SCHEMA_VERSION) && SCHEMA_VERSION === 3);
check('migration: batches gained attempt and reimport_reason; IDs unchanged', cols('batches').includes('attempt') && cols('batches').includes('reimport_reason') && JSON.stringify(s.db.prepare('SELECT id FROM batches').all().map(r => r.id)) === JSON.stringify(before.batches));
check('migration: foreign keys are intact', s.db.prepare('PRAGMA foreign_key_check').all().length === 0 && s.annotations(pid).length === 2);
check('migration: canonical_type filled for old annotation and quarantine rows', s.db.prepare("SELECT COUNT(*) AS n FROM quarantine WHERE canonical_type = 'lh_test'").get().n === 1 && s.db.prepare("SELECT COUNT(*) AS n FROM annotations WHERE canonical_type = 'lh_test'").get().n === 1);
s.setConsent(pid, 'lh_tests', false, null);
check('after migration: withdrawing LH consent removes the old " lh_test " quarantine row and the LH annotation', s.db.prepare("SELECT COUNT(*) AS n FROM quarantine WHERE raw_json LIKE '%lh_test%'").get().n === 0 && !s.annotations(pid).some(a => a.type === 'lh_test'));
s.setConsent(pid, 'lh_tests', true, null);
const re = preview(text, { format: 'csv', recordType: 'annotations', participantRef: ref, consents: s.consents(pid), existing: s.existingFor(pid), reimport: true });
s.commitImport(pid, { ...re, reimport: true, reimportReason: 'consent_granted_again' }, null, annotationHash);
check('after migration: an explicit reimport of the same file is stored as attempt 1', s.batches(pid).length === 2 && s.batches(pid)[1].attempt === 1 && s.annotations(pid).some(a => a.type === 'lh_test'));
s.close();
const again = openStore(db);
check('opening an already-migrated database again changes nothing', again.batches(pid).length === 2 && again.db.prepare('PRAGMA foreign_key_check').all().length === 0);
again.close();
done();
