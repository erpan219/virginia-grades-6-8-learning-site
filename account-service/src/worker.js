const SESSION_MS = 12 * 60 * 60 * 1000;
const MAX_BODY = 1100 * 1024;
const MAX_PROGRESS = 1024 * 1024;
const MAX_LEARNERS = 12;
const encoder = new TextEncoder();
const PROGRESS_KEYS = new Set([
  'vaDone.v1', 'vaLang.v1', 'vaLastLesson.v1', 'vaMistakes.v1', 'vaQE2.v1',
  'vaP3.math.v1', 'vaP3.science.v1', 'vaP3.english.v1', 'vaP3.history.v1',
  'vaP4.display.v1', 'vaP4.sched.v1', 'vaP4.activity.v1', 'vaP4.labs.v1',
  'vaJourney.v1', 'vaReview.v1', 'vaReviewPrefs.v1', 'vaFlashSrs.v1',
  'vaFlashSrs.v2', 'vaFlashSrs.settings.v1', 'vaFlashSrs.migration.v1',
  'vaFlashSrs.legacyBackup.v1', 'vaPath.v1', 'vaPractice.v1', 'vaSOL.v1',
  'vaAssessment.v1', 'vaMasteryHistory.v1', 'vaMicroSimProgress.v1',
  'vaMisconceptions.v1', 'vaPracticeAssistance.v1',
  'vaSolExam.v1', 'vaBridge.v1', 'vaMixed.v1', 'vaMixedMiss.v1', 'vaSessionBuilder.v1',
  'vaF02.unit-rate.v1', 'vaF02.absolute-value.v1', 'vaF02.one-step-equations.v1', 'vaF02.order-of-operations.v1',
  // Wire aliases: clients map these to the active profile's suffixed local keys.
  'va-ll:f08:v1', 'va-ll:f09:v1',
]);

class ApiError extends Error {
  constructor(status, code, message, extra = {}) { super(message); Object.assign(this, { status, code, extra }); }
}
function fail(status, code, message, extra) { throw new ApiError(status, code, message, extra); }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function fields(value, allowed) {
  if (!object(value) || Object.keys(value).some(k => !allowed.includes(k))) fail(400, 'invalid_request', 'Check the supplied fields.');
}
function username(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,31}$/.test(value)) fail(400, 'invalid_username', 'Use 3–32 letters, numbers, dots, underscores or hyphens.');
  return value.toLowerCase();
}
function displayName(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 60 || /[<>\u0000-\u001f\u007f]/.test(value)) fail(400, 'invalid_name', 'Use a nickname of 1–60 characters.');
  return value.trim();
}
function normalizeCode(value) { return typeof value === 'string' ? value.toLowerCase().replace(/[ -]/g, '').slice(0, 200) : ''; }
function randomHex(bytes) { return [...crypto.getRandomValues(new Uint8Array(bytes))].map(v => v.toString(16).padStart(2, '0')).join(''); }
function newCode() { return randomHex(20).match(/.{8}/g).join('-'); }
async function hash(value) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))].map(v => v.toString(16).padStart(2, '0')).join(''); }
async function codeHash(value, purpose = 'signin') { return hash(purpose + '\0' + normalizeCode(value)); }
async function equalHash(a, b) {
  const digests = await Promise.all([crypto.subtle.digest('SHA-256', encoder.encode(a)), crypto.subtle.digest('SHA-256', encoder.encode(b))]);
  return crypto.subtle.timingSafeEqual(digests[0], digests[1]);
}
function publicUser(u) { return { id: u.id, username: u.username, displayName: u.display_name, role: u.role, disabled: !!u.disabled }; }
async function readJSON(request) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) fail(415, 'json_required', 'Use application/json.');
  if (Number(request.headers.get('Content-Length')) > MAX_BODY) fail(413, 'payload_too_large', 'The request is too large.');
  const reader = request.body?.getReader();
  if (!reader) fail(400, 'invalid_json', 'JSON data is required.');
  let size = 0; const chunks = [];
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) { await reader.cancel(); fail(413, 'payload_too_large', 'The request is too large.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { fail(400, 'invalid_json', 'The JSON data could not be read.'); }
}
async function rateLimit(env, key, limit, seconds) {
  const now = Date.now();
  const bucket = await hash(env.RATE_LIMIT_SALT + '\0' + key);
  const result = await env.DB.prepare(`INSERT INTO rate_limits(bucket,count,expires_at) VALUES (?,1,?)
    ON CONFLICT(bucket) DO UPDATE SET count = CASE WHEN rate_limits.expires_at <= ? THEN 1 ELSE rate_limits.count+1 END,
    expires_at = CASE WHEN rate_limits.expires_at <= ? THEN excluded.expires_at ELSE rate_limits.expires_at END
    RETURNING count,expires_at`).bind(bucket, now + seconds * 1000, now, now).first();
  if (result.count > limit) fail(429, 'rate_limited', 'Please wait before trying again.', { retryAfter: Math.max(1, Math.ceil((result.expires_at - now) / 1000)) });
}
async function session(env, user) {
  const token = randomHex(32), tokenHash = await hash('session\0' + token), now = Date.now(), expiresAt = now + SESSION_MS;
  const r = await env.DB.prepare(`INSERT INTO sessions(token_hash,user_id,credential_version,expires_at,created_at)
    SELECT ?,id,credential_version,?,? FROM users WHERE id=? AND credential_version=? AND disabled=0`)
    .bind(tokenHash, expiresAt, now, user.id, user.credential_version).run();
  if (!r.meta.changes) fail(401, 'sign_in_required', 'Please sign in again.');
  return { token, expiresAt: new Date(expiresAt).toISOString(), user: publicUser(user) };
}
async function authenticate(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!/^Bearer [a-f0-9]{64}$/.test(auth)) fail(401, 'sign_in_required', 'Please sign in.');
  const tokenHash = await hash('session\0' + auth.slice(7));
  const user = await env.DB.prepare(`SELECT u.*,s.token_hash FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>? AND s.credential_version=u.credential_version AND u.disabled=0`)
    .bind(tokenHash, Date.now()).first();
  if (!user) fail(401, 'sign_in_required', 'Your session ended. Please sign in again.');
  return user;
}
function requireParent(user) { if (user.role !== 'parent') fail(403, 'parent_required', 'A parent account is required.'); }
async function ownedLearner(env, parent, id) {
  requireParent(parent);
  const u = await env.DB.prepare('SELECT * FROM users WHERE id=? AND parent_id=? AND role=\'learner\'').bind(id, parent.id).first();
  if (!u) fail(404, 'learner_not_found', 'This learner was not found.');
  return u;
}
function safeJSON(value, depth = 0, budget = { nodes: 0 }) {
  if (++budget.nodes > 40000 || depth > 20) fail(400, 'invalid_progress', 'Progress is too deeply nested or complex.');
  if (typeof value === 'string') {
    // This is a plain-text learning snapshot, never an HTML document or executable template.
    // Clients must still use textContent/escaping when displaying any cloud data.
    if (value.length > 16000 || /<\/?[a-z!]/i.test(value) || /\u0000/.test(value)) fail(400, 'invalid_progress', 'Progress contains unsupported text.');
  } else if (typeof value === 'number') {
    if (!Number.isFinite(value) || Math.abs(value) > 1e16) fail(400, 'invalid_progress', 'Progress contains an invalid number.');
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key.length > 160 || ['__proto__', 'prototype', 'constructor'].includes(key) || /[<>\u0000-\u001f]/.test(key)) fail(400, 'invalid_progress', 'Progress contains an invalid field.');
      safeJSON(child, depth + 1, budget);
    }
  }
}
function validateProgress(data) {
  if (!object(data) || Object.keys(data).length > PROGRESS_KEYS.size) fail(400, 'invalid_progress', 'Expected a learning-progress snapshot.');
  const output = Object.create(null);
  for (const [key, raw] of Object.entries(data)) {
    if (!PROGRESS_KEYS.has(key) || typeof raw !== 'string') fail(400, 'invalid_progress', 'Progress includes an unsupported field.');
    if (key === 'vaLang.v1') {
      if (!['en', 'zh', 'bi'].includes(raw)) fail(400, 'invalid_progress', 'The saved language is invalid.');
    } else if (key === 'vaLastLesson.v1') {
      if (!/^\d{1,3}$/.test(raw) || Number(raw) > 72) fail(400, 'invalid_progress', 'The saved lesson is invalid.');
    } else {
      let parsed; try { parsed = JSON.parse(raw); } catch { fail(400, 'invalid_progress', 'Progress contains invalid JSON.'); }
      if (key === 'vaDone.v1') {
        if (!Array.isArray(parsed) || parsed.length > 73 || parsed.some(i => !Number.isInteger(i) || i < 0 || i > 72)) fail(400, 'invalid_progress', 'Completed lessons are invalid.');
      } else if (!object(parsed)) fail(400, 'invalid_progress', 'Progress contains an invalid record.');
      safeJSON(parsed);
    }
    output[key] = raw;
  }
  const serialized = JSON.stringify(output);
  if (encoder.encode(serialized).byteLength > MAX_PROGRESS) fail(413, 'progress_too_large', 'Progress exceeds the sync limit. Export a local backup.');
  return serialized;
}
async function progress(request, env, learner, body) {
  if (learner.role !== 'learner') fail(403, 'learner_required', 'Choose a learner account.');
  if (request.method === 'GET') {
    const r = await env.DB.prepare('SELECT revision,data,updated_at FROM progress WHERE user_id=?').bind(learner.id).first();
    return { revision: r?.revision || 0, data: r ? JSON.parse(r.data) : {}, updatedAt: r ? new Date(r.updated_at).toISOString() : null };
  }
  if (request.method !== 'PUT') fail(405, 'method_not_allowed', 'Use GET or PUT.');
  fields(body, ['revision', 'data']);
  if (!Number.isSafeInteger(body.revision) || body.revision < 0) fail(400, 'invalid_revision', 'A valid revision is required.');
  const data = validateProgress(body.data), now = Date.now();
  await rateLimit(env, 'sync:' + learner.id, 120, 60);
  const r = await env.DB.prepare(`INSERT INTO progress(user_id,revision,data,updated_at)
    SELECT ?,1,?,? WHERE ?=0
    ON CONFLICT(user_id) DO UPDATE SET revision=progress.revision+1,data=excluded.data,updated_at=excluded.updated_at
    WHERE progress.revision=? RETURNING revision`).bind(learner.id, data, now, body.revision, body.revision).first();
  // Existing snapshots use UPDATE: the INSERT SELECT guard above intentionally handles only revision zero.
  const updated = r || (body.revision > 0 ? await env.DB.prepare(`UPDATE progress SET revision=revision+1,data=?,updated_at=?
    WHERE user_id=? AND revision=? RETURNING revision`).bind(data, now, learner.id, body.revision).first() : null);
  if (!updated) {
    const current = await env.DB.prepare('SELECT revision FROM progress WHERE user_id=?').bind(learner.id).first();
    fail(409, 'revision_conflict', 'Another device saved newer progress. Choose which copy to keep.', { currentRevision: current?.revision || 0 });
  }
  return { revision: updated.revision, updatedAt: new Date(now).toISOString() };
}
async function handle(request, env) {
  const path = new URL(request.url).pathname, method = request.method;
  if (path === '/v1/health' && method === 'GET') return { status: 'ok', version: 1 };
  if (!env.DB || !env.RATE_LIMIT_SALT || env.RATE_LIMIT_SALT.length < 32) fail(503, 'not_configured', 'Account sync is not configured yet.');
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const isAuth = ['/v1/parent/register', '/v1/auth/login', '/v1/auth/recover'].includes(path);
  if (isAuth) {
    if (method !== 'POST') fail(405, 'method_not_allowed', 'Use POST.');
    await rateLimit(env, 'auth-ip:' + ip, 30, 900);
    const body = await readJSON(request);
    if (path === '/v1/parent/register') {
      fields(body, ['username', 'setupCode']);
      const name = username(body.username);
      if (!env.SETUP_CODE || normalizeCode(env.SETUP_CODE).length < 32) fail(503, 'registration_closed', 'Parent setup is not enabled.');
      if (!await equalHash(await codeHash(body.setupCode, 'setup'), await codeHash(env.SETUP_CODE, 'setup'))) fail(401, 'invalid_credentials', 'The setup code is not valid.');
      const claimed = await env.DB.prepare('SELECT singleton FROM setup_claim WHERE singleton=1').first();
      if (claimed) fail(409, 'registration_closed', 'This family already has a parent account. Use sign-in or recovery.');
      const code = newCode(), recoveryCode = newCode(), id = crypto.randomUUID(), now = Date.now();
      try {
        await env.DB.batch([
          env.DB.prepare(`INSERT INTO users(id,username,display_name,role,code_hash,recovery_hash,created_at) VALUES (?,?,?,'parent',?,?,?)`).bind(id, name, 'Parent', await codeHash(code), await codeHash(recoveryCode, 'recovery'), now),
          env.DB.prepare('INSERT INTO setup_claim(singleton,parent_id,created_at) VALUES (1,?,?)').bind(id, now),
        ]);
      } catch (error) {
        if (String(error).includes('UNIQUE constraint')) fail(409, 'registration_closed', 'Parent setup is already complete or the username is in use.');
        throw error;
      }
      const u = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();
      return { ...await session(env, u), signInCode: code, recoveryCode };
    }
    fields(body, path.endsWith('recover') ? ['username', 'recoveryCode'] : ['username', 'code']);
    const name = username(body.username);
    await rateLimit(env, 'auth-user:' + name, 10, 900);
    const u = await env.DB.prepare('SELECT * FROM users WHERE username=?').bind(name).first();
    const recovery = path.endsWith('recover'), provided = await codeHash(recovery ? body.recoveryCode : body.code, recovery ? 'recovery' : 'signin');
    const valid = await equalHash(provided, (recovery ? u?.recovery_hash : u?.code_hash) || '0'.repeat(64));
    if (!u || u.disabled || !valid || (recovery && u.role !== 'parent')) fail(401, 'invalid_credentials', 'The username or code is not valid.');
    if (!recovery) return session(env, u);
    const signInCode = newCode(), recoveryCode = newCode(), nextHash = await codeHash(signInCode);
    const results = await env.DB.batch([
      env.DB.prepare('UPDATE users SET code_hash=?,recovery_hash=?,credential_version=credential_version+1 WHERE id=? AND recovery_hash=? AND credential_version=?')
        .bind(nextHash, await codeHash(recoveryCode, 'recovery'), u.id, u.recovery_hash, u.credential_version),
      env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND credential_version<(SELECT credential_version FROM users WHERE id=?)').bind(u.id, u.id),
    ]);
    if (!results[0].meta.changes) fail(401, 'invalid_credentials', 'That recovery code has already been used.');
    return { ...await session(env, { ...u, credential_version: u.credential_version + 1 }), signInCode, recoveryCode };
  }
  const user = await authenticate(request, env);
  if (path === '/v1/me' && method === 'GET') return { user: publicUser(user), progressKeys: [...PROGRESS_KEYS], maxProgressBytes: MAX_PROGRESS };
  if (path === '/v1/auth/logout' && method === 'POST') {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(user.token_hash).run(); return { ok: true };
  }
  if (path === '/v1/auth/logout-all' && method === 'POST') {
    await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id).run(); return { ok: true };
  }
  if (path === '/v1/learners') {
    requireParent(user);
    if (method === 'GET') return { learners: (await env.DB.prepare('SELECT * FROM users WHERE parent_id=? ORDER BY created_at,id').bind(user.id).all()).results.map(publicUser) };
    if (method !== 'POST') fail(405, 'method_not_allowed', 'Use GET or POST.');
    await rateLimit(env, 'manage:' + user.id, 30, 3600);
    const body = await readJSON(request); fields(body, ['username', 'displayName']);
    const name = username(body.username), label = displayName(body.displayName), id = crypto.randomUUID(), code = newCode();
    try {
      const r = await env.DB.prepare(`INSERT INTO users(id,username,display_name,role,parent_id,code_hash,created_at)
        SELECT ?,?,?,'learner',?,?,? WHERE (SELECT COUNT(*) FROM users WHERE parent_id=?)<?`)
        .bind(id, name, label, user.id, await codeHash(code), Date.now(), user.id, MAX_LEARNERS).run();
      if (!r.meta.changes) fail(409, 'learner_limit', 'This family has reached its 12 learner limit.');
    } catch (error) {
      if (String(error).includes('UNIQUE constraint')) fail(409, 'username_taken', 'That username is already in use.'); throw error;
    }
    return { learner: publicUser(await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first()), signInCode: code };
  }
  if (path === '/v1/progress') return progress(request, env, user, method === 'PUT' ? await readJSON(request) : null);
  const match = /^\/v1\/learners\/([a-f0-9-]{36})(?:\/(reset-code|progress))?$/.exec(path);
  if (match) {
    const learner = await ownedLearner(env, user, match[1]);
    if (match[2] === 'progress') return progress(request, env, learner, method === 'PUT' ? await readJSON(request) : null);
    await rateLimit(env, 'manage:' + user.id, 30, 3600);
    if (match[2] === 'reset-code' && method === 'POST') {
      const code = newCode();
      await env.DB.batch([
        env.DB.prepare('UPDATE users SET code_hash=?,credential_version=credential_version+1 WHERE id=?').bind(await codeHash(code), learner.id),
        env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(learner.id),
      ]);
      return { learner: publicUser(learner), signInCode: code };
    }
    if (!match[2] && method === 'PATCH') {
      const body = await readJSON(request); fields(body, ['displayName', 'disabled']);
      if (!Object.keys(body).length || (body.disabled !== undefined && typeof body.disabled !== 'boolean')) fail(400, 'invalid_request', 'Supply a name or enabled status.');
      const label = body.displayName === undefined ? learner.display_name : displayName(body.displayName);
      const disabled = body.disabled === undefined ? learner.disabled : Number(body.disabled);
      await env.DB.batch([
        env.DB.prepare('UPDATE users SET display_name=?,disabled=?,credential_version=credential_version+1 WHERE id=?').bind(label, disabled, learner.id),
        env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(learner.id),
      ]);
      return { learner: publicUser({ ...learner, display_name: label, disabled }) };
    }
    fail(405, 'method_not_allowed', 'This operation is not supported.');
  }
  fail(404, 'not_found', 'This endpoint was not found.');
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin'), allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Vary': 'Origin' };
    if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
    try {
      if (origin && !allowed.includes(origin)) fail(403, 'origin_not_allowed', 'This site is not allowed to use account sync.');
      if (request.method === 'OPTIONS') {
        if (!origin) fail(403, 'origin_required', 'A site origin is required.');
        return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,OPTIONS', 'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Access-Control-Max-Age': '600' } });
      }
      return Response.json(await handle(request, env), { headers });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.extra.retryAfter) headers['Retry-After'] = String(error.extra.retryAfter);
        return Response.json({ error: { code: error.code, message: error.message, ...error.extra } }, { status: error.status, headers });
      }
      // Deliberately never log credentials, request bodies, usernames or learning history.
      console.error(JSON.stringify({ event: 'account_service_error', path: new URL(request.url).pathname.replace(/[a-f0-9-]{36}/g, ':id') }));
      return Response.json({ error: { code: 'service_unavailable', message: 'Sync is temporarily unavailable. Your device copy is unchanged.' } }, { status: 503, headers });
    }
  },
  async scheduled(_event, env) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(Date.now()),
      env.DB.prepare('DELETE FROM rate_limits WHERE expires_at<=?').bind(Date.now()),
    ]);
  },
};
