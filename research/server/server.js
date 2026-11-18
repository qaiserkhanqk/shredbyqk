// Local-only HTTP API and static dashboard. Built on node:http; no third-party code, analytics or external calls.
// • Binds to 127.0.0.1 by default and refuses other addresses unless explicitly overridden for a documented reason.
// • Authentication by session cookie (HttpOnly, SameSite=Strict, Secure by default) + CSRF token on every change.
// • Authorisation is server-side on every request; hiding a button in the UI is never the control.
// • Logs record method, route template, status and timing only: no bodies, query strings, references or values.
// • Every JSON response passes through the output-policy layer.
import { createServer as httpServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { openStore, CONSENT_SCOPES, FEATURES, ConsentError } from './store.js';
import { preview, annotationHash } from '../lib/ingest.js';
import { analyse } from '../lib/pipeline.js';
import { CONFIG } from '../lib/config.js';
import { toCSV } from '../lib/csv.js';
import * as policy from '../lib/policy.js';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', 'web');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const REF = /^[A-Za-z0-9_-]{4,64}$/;

export function settingsFromEnv(env = process.env) {
  return {
    host: env.RESEARCH_HOST || '127.0.0.1', port: Number(env.RESEARCH_PORT || 8787), db: env.RESEARCH_DB || join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'research.sqlite'),
    secureCookies: env.RESEARCH_SECURE_COOKIES !== '0', allowNonLocal: env.RESEARCH_ALLOW_NON_LOCAL === '1',
    idleMs: Number(env.RESEARCH_SESSION_IDLE_MIN || 30) * 60e3, absoluteMs: Number(env.RESEARCH_SESSION_MAX_HOURS || 8) * 36e5,
  };
}

class HttpError extends Error { constructor(status, code) { super(code); this.status = status; this.code = code; } }
const fail = (status, code) => { throw new HttpError(status, code); };

function rateLimiter() {
  const buckets = new Map(), LIMITS = { login: [10, 60e3], import: [20, 60e3], default: [600, 60e3] };
  return (key, cls) => {
    const [n, win] = LIMITS[cls] || LIMITS.default, k = `${cls}|${key}`, t = Date.now(), b = buckets.get(k);
    if (!b || t - b.start > win) { buckets.set(k, { start: t, n: 1 }); return true; }
    return ++b.n <= n;
  };
}

export function createApp({ store, settings, log = line => process.stderr.write(line + '\n'), now = () => Date.now() }) {
  const limit = rateLimiter();
  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...securityHeaders, ...headers });
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  };
  const securityHeaders = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Cross-Origin-Opener-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'", 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' };
  const ok = (res, payload, status = 200) => {
    let out; try { out = policy.apply(res.viewerRole === 'participant' ? forParticipant(payload) : payload); } catch (e) { if (e instanceof policy.PolicyViolation) { store.audit(null, 'policy_violation_blocked', null, 'blocked', { code: e.code }); fail(500, 'output_blocked_by_policy'); } throw e; }
    send(res, status, out);
  };
  const cookie = (req, name) => (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(name + '='))?.slice(name.length + 1);
  const setCookie = v => `rs_session=${v}; Path=/; HttpOnly; SameSite=Strict${settings.secureCookies ? '; Secure' : ''}; Max-Age=${Math.floor(settings.absoluteMs / 1000)}`;
  async function body(req, max) {
    const ct = req.headers['content-type'] || ''; if (!ct.startsWith('application/json')) fail(415, 'json_required');
    if (Number(req.headers['content-length']) > max) { req.resume(); fail(413, 'body_too_large'); }
    const chunks = []; let n = 0, over = false;
    for await (const c of req) { n += c.length; if (n > max) over = true; else chunks.push(c); } // drain fully, keep at most `max`
    if (over) fail(413, 'body_too_large');
    try { const v = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); if (!v || typeof v !== 'object' || Array.isArray(v)) fail(400, 'json_object_required'); return v; } catch (e) { if (e instanceof HttpError) throw e; fail(400, 'invalid_json'); }
  }
  function participantFor(session, ref) {
    if (!REF.test(String(ref))) fail(404, 'not_found');
    const p = store.participantByRef(ref);
    if (!p || !store.canAccess(session, p.id)) { store.audit(session.userId, 'access_denied', p?.id ?? null, 'denied'); fail(404, 'not_found'); } // same answer whether it exists or not
    return p;
  }
  const needRole = (s, ...roles) => { if (!roles.includes(s.role)) { store.audit(s.userId, 'role_denied', null, 'denied'); fail(403, 'forbidden'); } };
  function analysisFor(p, asOf, role) {
    const out = analyse({ observations: store.observations(p.id), annotations: store.annotations(p.id), asOf, features: store.features(p.id) });
    if (role === 'researcher') for (const r of [...(Array.isArray(out.estimates) ? out.estimates : []), ...(out.forecasts?.layer ? [out.forecasts] : [])]) store.saveRun(p.id, r); // versioned; identical runs are not duplicated
    return out;
  }

  const routes = [
    ['POST', /^\/api\/login$/, async (req, res, m, ip) => {
      const b = await body(req, 4096);
      if (!limit(`${ip}|${String(b.username).slice(0, 40)}`, 'login')) fail(429, 'too_many_attempts');
      const v = store.verifyLogin(b.username, b.password);
      if (!v.ok) { store.audit(null, 'login_failed', null, v.locked ? 'locked' : 'denied'); fail(401, 'login_failed'); }
      const s = store.createSession(v.user.id); store.audit(v.user.id, 'login', null);
      res.setHeader('Set-Cookie', setCookie(s.token));
      ok(res, { user: { username: v.user.username, role: v.user.role }, csrf: s.csrf });
    }, { public: true }],
    ['POST', /^\/api\/logout$/, (req, res, m, ip, s) => { store.endSession(cookie(req, 'rs_session')); res.setHeader('Set-Cookie', setCookie('x').replace(/Max-Age=\d+/, 'Max-Age=0')); store.audit(s.userId, 'logout', null); ok(res, { ok: true }); }],
    ['GET', /^\/api\/me$/, (req, res, m, ip, s) => ok(res, { user: { username: s.username, role: s.role }, csrf: s.csrf, features: FEATURES, consentScopes: CONSENT_SCOPES, config: { version: CONFIG.version, status: CONFIG.status } })],
    ['POST', /^\/api\/users$/, async (req, res, m, ip, s) => {
      needRole(s, 'admin'); const b = await body(req, 4096);
      if (!['researcher', 'participant', 'admin'].includes(b.role)) fail(400, 'role_invalid');
      const p = b.role === 'participant' ? store.participantByRef(b.participantRef) : null;
      if (b.role === 'participant' && !p) fail(400, 'participant_required');
      try { const id = store.createUser({ username: b.username, password: b.password, role: b.role, participantId: p?.id ?? null }); store.audit(s.userId, 'user_created', p?.id ?? null); ok(res, { id }, 201); }
      catch (e) { fail(400, e.code || 'user_invalid'); }
    }],
    ['POST', /^\/api\/assignments$/, async (req, res, m, ip, s) => { needRole(s, 'admin'); const b = await body(req, 4096); const p = store.participantByRef(b.participantRef); if (!p) fail(404, 'not_found'); store.assign(Number(b.userId), p.id); store.audit(s.userId, 'assignment_created', p.id); ok(res, { ok: true }); }],
    ['GET', /^\/api\/participants$/, (req, res, m, ip, s) => ok(res, { participants: store.listParticipants(s).map(p => ({ ref: p.ref, createdAt: p.created_at })) })],
    ['POST', /^\/api\/participants$/, async (req, res, m, ip, s) => {
      needRole(s, 'researcher'); const b = await body(req, 4096);
      if (!REF.test(String(b.ref))) fail(400, 'ref_invalid');
      if (b.adultConfirmed !== true) fail(400, 'adult_confirmation_required'); // no minors in this prototype
      if (store.participantByRef(b.ref)) fail(409, 'ref_exists');
      const id = store.createParticipant({ ref: b.ref, adultConfirmed: true }, s.userId); store.audit(s.userId, 'participant_created', id); ok(res, { ref: b.ref }, 201);
    }],
    ['GET', /^\/api\/participants\/([^/]+)$/, (req, res, m, ip, s) => {
      const p = participantFor(s, m[1]);
      ok(res, { ref: p.ref, consents: store.consents(p.id), consentLog: store.consentLog(p.id), features: store.features(p.id), batches: store.batches(p.id), quarantineCount: store.quarantine(p.id).length });
    }],
    ['POST', /^\/api\/participants\/([^/]+)\/consents$/, async (req, res, m, ip, s) => {
      needRole(s, 'researcher', 'participant'); const p = participantFor(s, m[1]), b = await body(req, 4096);
      if (!CONSENT_SCOPES.includes(b.scope)) fail(400, 'scope_invalid');
      if (s.role === 'researcher' && b.granted) fail(403, 'use_record_signed_consent'); // a researcher records consent only from a signed form
      const removed = store.setConsent(p.id, b.scope, !!b.granted, s.userId); store.audit(s.userId, `consent_${b.granted ? 'granted' : 'withdrawn'}`, p.id, 'ok', { scope: b.scope, removed }); ok(res, { consents: store.consents(p.id), removed });
    }],
    ['POST', /^\/api\/participants\/([^/]+)\/consents\/record-signed$/, async (req, res, m, ip, s) => {
      needRole(s, 'researcher'); const p = participantFor(s, m[1]), b = await body(req, 4096);
      if (!CONSENT_SCOPES.includes(b.scope) || b.signedFormReference !== true) fail(400, 'signed_form_confirmation_required');
      store.setConsent(p.id, b.scope, true, s.userId); store.audit(s.userId, 'consent_recorded_from_signed_form', p.id, 'ok', { scope: b.scope }); ok(res, { consents: store.consents(p.id) });
    }],
    ['POST', /^\/api\/participants\/([^/]+)\/features$/, async (req, res, m, ip, s) => {
      needRole(s, 'researcher'); const p = participantFor(s, m[1]), b = await body(req, 4096);
      try { policy.assertFeatureAllowed(b.name); } catch { store.audit(s.userId, 'prohibited_feature_refused', p.id, 'denied'); fail(400, 'feature_prohibited'); }
      if (!FEATURES.includes(b.name)) fail(400, 'feature_unknown');
      store.setFeature(p.id, b.name, !!b.enabled, s.userId); store.audit(s.userId, `feature_${b.enabled ? 'enabled' : 'disabled'}`, p.id, 'ok', { name: b.name }); ok(res, { features: store.features(p.id) });
    }],
    ['POST', /^\/api\/participants\/([^/]+)\/imports\/preview$/, async (req, res, m, ip, s) => {
      needRole(s, 'researcher'); const p = participantFor(s, m[1]);
      if (!limit(`${s.userId}`, 'import')) fail(429, 'too_many_imports');
      const b = await body(req, Math.ceil(CONFIG.limits.maxUploadBytes * 1.5));
      const c = store.consents(p.id); if (!c.core_research) fail(409, 'core_research_consent_missing');
      // Explicit, audited reimport (issue 2 reported against f67000b): revalidates a previously imported file under the
      // CURRENT consent. It needs a reason code. Rows already stored are skipped; deleted data is never restored
      // unless a file is reimported like this.
      const reimport = b.reimport === true, reason = String(b.reason || '');
      if (reimport && !/^[a-z0-9_]{3,60}$/.test(reason)) fail(400, 'reimport_reason_required');
      const pv = preview(String(b.content ?? ''), { format: b.format, recordType: b.recordType, participantRef: p.ref, filename: String(b.filename || ''), existing: store.existingFor(p.id), consents: c, reimport });
      if (!pv.ok) { store.audit(s.userId, 'import_preview_failed', p.id, 'failed', { error: pv.error }); return ok(res, { ok: false, error: pv.error, line: pv.line ?? null }, 400); }
      if (reimport) Object.assign(pv, { reimport: true, reimportReason: reason });
      const id = pv.duplicateBatch ? null : store.savePreview(p.id, s.userId, pv);
      store.audit(s.userId, reimport ? 'import_reimport_previewed' : 'import_previewed', p.id, 'ok', { counts: pv.counts, ...(reimport ? { reason } : {}) });
      ok(res, { ok: true, previewId: id, duplicateBatch: pv.duplicateBatch, reimportAvailable: !!pv.duplicateBatch, reimport, counts: pv.counts, recordType: pv.recordType, quarantined: pv.quarantined.slice(0, 200).map(q => ({ line: q.line, reasons: q.reasons, rejected: !!q.rejected })), ingestVersion: pv.ingestVersion, configVersion: pv.configVersion });
    }],
    ['POST', /^\/api\/participants\/([^/]+)\/imports\/commit$/, async (req, res, m, ip, s) => {
      needRole(s, 'researcher'); const p = participantFor(s, m[1]), b = await body(req, 4096);
      const pv = store.takePreview(b.previewId, p.id, s.userId); if (!pv) fail(404, 'preview_not_found_or_expired');
      let r; try { r = store.commitImport(p.id, pv, s.userId, annotationHash); } catch (e) { if (e instanceof ConsentError) { store.audit(s.userId, 'import_commit_refused', p.id, 'denied', { code: e.code }); fail(409, e.code); } throw e; }
      store.audit(s.userId, 'import_committed', p.id, 'ok', { counts: pv.counts, duplicateBatch: r.duplicateBatch, ...(pv.reimport ? { reimport: true, reason: pv.reimportReason } : {}) });
      ok(res, { ok: true, ...r, counts: pv.counts });
    }],
    ['GET', /^\/api\/participants\/([^/]+)\/analysis$/, (req, res, m, ip, s, url) => {
      const p = participantFor(s, m[1]), asOfQ = url.searchParams.get('asOf');
      const asOf = asOfQ ? Date.parse(asOfQ) : now(); if (!Number.isFinite(asOf)) fail(400, 'asOf_invalid');
      store.audit(s.userId, 'analysis_viewed', p.id);
      const a = analysisFor(p, asOf, s.role);
      // Participant-facing view: recorded observations and descriptive summaries only. Experimental estimates and
      // forecasts are for researchers, and no timing derived from temperature is shown to participants.
      if (s.role === 'participant') { a.estimates = { status: 'not_shown_to_participants', reasons: ['research_only_layer'] }; a.forecasts = { status: 'not_shown_to_participants', reasons: ['research_only_layer'] }; }
      ok(res, a);
    }],
    ['GET', /^\/api\/participants\/([^/]+)\/quarantine$/, (req, res, m, ip, s) => { needRole(s, 'researcher'); const p = participantFor(s, m[1]); ok(res, { quarantine: store.quarantine(p.id) }); }],
    // Stored runs are experimental outputs (historical versions): researchers only, like the experimental layers of
    // /analysis (issue 1 reported against b3d9589).
    ['GET', /^\/api\/participants\/([^/]+)\/runs$/, (req, res, m, ip, s) => { needRole(s, 'researcher'); const p = participantFor(s, m[1]); ok(res, { runs: store.runs(p.id) }); }],
    ['POST', /^\/api\/participants\/([^/]+)\/corrections$/, async (req, res, m, ip, s) => {
      needRole(s, 'researcher'); const p = participantFor(s, m[1]), b = await body(req, 4096);
      if (!['exclude', 'restore'].includes(b.action) || !/^[a-z_]{3,40}$/.test(String(b.reason))) fail(400, 'correction_invalid');
      if (!store.addCorrection(p.id, Number(b.observationId), b.action, b.reason, s.userId)) fail(404, 'not_found');
      store.audit(s.userId, `observation_${b.action}`, p.id); ok(res, { ok: true });
    }],
    ['GET', /^\/api\/participants\/([^/]+)\/export$/, (req, res, m, ip, s, url) => {
      const p = participantFor(s, m[1]), fmt = url.searchParams.get('format') || 'json';
      store.audit(s.userId, `export_${fmt}`, p.id);
      const obs = store.observations(p.id);
      if (fmt === 'csv') {
        const cols = ['observation_id', 'timestamp_utc', 'utc_offset_minutes', 'device_model', 'device_serial_pseudonym', 'firmware', 'sensor_site', 'measurement_kind', 'derivation', 'aggregation', 'night_label', 'source_value', 'source_unit', 'value_c', 'excluded_by_correction'];
        const rows = obs.map(o => ({ observation_id: o.id, timestamp_utc: o.tsUtc ? new Date(o.tsUtc).toISOString() : '', utc_offset_minutes: o.offsetMin, device_model: o.device.model, device_serial_pseudonym: o.device.serial, firmware: o.device.firmware, sensor_site: o.site, measurement_kind: o.kind, derivation: o.derivation, aggregation: o.aggregation, night_label: o.nightLabel, source_value: o.sourceValue, source_unit: o.sourceUnit, value_c: o.valueC, excluded_by_correction: o.excludedBy ? 'yes' : '' }));
        policy.checkValue(rows);
        res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="export-${p.ref}.csv"`, 'Cache-Control': 'no-store', ...securityHeaders });
        return res.end(`# ${policy.LABEL}\r\n` + toCSV(cols, rows));
      }
      const researcher = s.role === 'researcher'; // participant exports follow the same rules as /quarantine and /runs (issue 1)
      ok(res, { format: 'research-export-1', participantRef: p.ref, exportedAt: new Date(now()).toISOString(), consents: store.consentLog(p.id), features: store.features(p.id), batches: store.batches(p.id), observations: obs, annotations: store.annotations(p.id),
        ...(researcher ? { quarantine: store.quarantine(p.id), derivedRuns: store.runs(p.id) } : { notIncluded: ['quarantined rows (researcher review)', 'experimental research outputs'] }), corrections: store.corrections(p.id),
        note: 'Contains sensitive health data. Not encrypted. Synthetic data only in this prototype.' });
    }],
    ['DELETE', /^\/api\/participants\/([^/]+)$/, async (req, res, m, ip, s) => {
      needRole(s, 'researcher', 'participant'); const p = participantFor(s, m[1]), b = await body(req, 4096);
      if (b.confirmRef !== p.ref) fail(400, 'confirmation_required');
      const counts = store.deleteParticipant(p.id, s.userId);
      if (s.role === 'participant') res.setHeader('Set-Cookie', setCookie('x').replace(/Max-Age=\d+/, 'Max-Age=0'));
      ok(res, { deleted: true, counts, notReached: ['exports already downloaded', 'database backups made before deletion (see retention policy)'] });
    }],
  ];

  return async function handle(req, res) {
    const t0 = Date.now(), reqId = randomBytes(6).toString('hex'), ip = req.socket.remoteAddress || '?';
    let route = 'static', status = 200;
    try {
      const url = new URL(req.url, 'http://local');
      if (!url.pathname.startsWith('/api/')) return serveStatic(url.pathname, res, securityHeaders, (st) => { status = st; });
      if (!limit(ip, 'default')) fail(429, 'rate_limited');
      const found = routes.find(([m, re]) => m === req.method && re.test(url.pathname));
      if (!found) fail(404, 'not_found');
      const [, re, fn, opt] = found; route = `${req.method} ${re.source}`;
      let session = null;
      if (!opt?.public) {
        session = store.getSession(cookie(req, 'rs_session'), settings); if (!session) fail(401, 'not_signed_in');
        res.viewerRole = session.role;
      }
      if (req.method !== 'GET') { // CSRF: same-origin only, and the session's token on every change
        const origin = req.headers.origin; if (origin && new URL(origin).host !== req.headers.host) fail(403, 'cross_origin');
        if (session && req.headers['x-csrf-token'] !== session.csrf) fail(403, 'csrf');
      }
      await fn(req, res, url.pathname.match(re), ip, session, url);
      status = res.statusCode;
    } catch (e) {
      status = e instanceof HttpError ? e.status : 500;
      if (!res.headersSent) send(res, status, { error: e instanceof HttpError ? e.code : 'internal_error', label: policy.LABEL });
    } finally {
      log(JSON.stringify({ t: new Date().toISOString(), reqId, method: req.method, route: route.replace(/\\\//g, '/'), status, ms: Date.now() - t0 }));
    }
  };
}

/* Defence in depth for participant sessions (issue 1): whatever an endpoint returns, experimental outputs (objects with
   layer 'estimate' or 'forecast') and verbatim quarantined cells never reach a participant. Endpoints already omit
   them; this catches any alternate path. */
export function forParticipant(v) {
  if (Array.isArray(v)) return v.map(forParticipant);
  if (!v || typeof v !== 'object') return v;
  if (v.layer === 'estimate' || v.layer === 'forecast') return { status: 'not_shown_to_participants', reasons: ['research_only_layer'] };
  return Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'verbatimSource').map(([k, x]) => [k, forParticipant(x)]));
}

function serveStatic(path, res, headers, setStatus) {
  const rel = path === '/' ? 'index.html' : normalize(path).replace(/^([/\\])+/, '');
  const file = join(WEB, rel);
  if (!file.startsWith(WEB + '/') || !existsSync(file) || !TYPES[extname(file)]) { setStatus(404); res.writeHead(404, headers); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)], 'Cache-Control': 'no-store', ...headers });
  res.end(readFileSync(file));
}

export function start(settings = settingsFromEnv()) {
  const local = ['127.0.0.1', '::1', 'localhost'].includes(settings.host);
  if (!local && !settings.allowNonLocal) throw new Error(`Refusing to bind to ${settings.host}: this prototype is local-only. See research/docs/threat-model.md.`);
  const store = openStore(settings.db);
  const server = httpServer(createApp({ store, settings }));
  return new Promise(r => server.listen(settings.port, settings.host, () => r({ server, store, port: server.address().port })));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = settingsFromEnv();
  start(s).then(({ port }) => console.log(`Research prototype (synthetic data only) on http://${s.host}:${port}/  — ${policy.LABEL}`)).catch(e => { console.error(e.message); process.exit(1); });
}
