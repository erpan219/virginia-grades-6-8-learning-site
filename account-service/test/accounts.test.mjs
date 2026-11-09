import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const origin = 'http://localhost:8000';
const setupCode = 'local-test-only-0123456789abcdef0123456789abcdef';
async function fixture(t) {
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: await readFile(new URL('../src/worker.js', import.meta.url), 'utf8'), compatibilityDate: '2026-11-09',
    d1Databases: ['DB'], bindings: { ALLOWED_ORIGINS: origin, SETUP_CODE: setupCode, RATE_LIMIT_SALT: 'test-only-salt-0123456789abcdef0123456789' } }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  const sql = await readFile(new URL('../migrations/0001_accounts.sql', import.meta.url), 'utf8');
  for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await db.prepare(statement).run();
  let counter = 0;
  async function api(path, { method = 'GET', body, token, requestOrigin = origin, ip = `192.0.2.${++counter}`, rawBody } = {}) {
    const headers = { Origin: requestOrigin, 'CF-Connecting-IP': ip };
    if (body !== undefined || rawBody !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await mf.dispatchFetch('http://account.test' + path, { method, headers, body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)) });
    return { status: response.status, headers: response.headers, data: response.status === 204 ? null : await response.json() };
  }
  const parent = (await api('/v1/parent/register', { method: 'POST', body: { username: 'test.parent', setupCode } })).data;
  return { mf, db, api, parent };
}
async function learner(f, name = 'learner.one') {
  const created = await f.api('/v1/learners', { method: 'POST', token: f.parent.token, body: { username: name, displayName: 'Learner 一' } });
  assert.equal(created.status, 200);
  const signed = await f.api('/v1/auth/login', { method: 'POST', body: { username: name, code: created.data.signInCode } });
  assert.equal(signed.status, 200);
  return { ...created.data, ...signed.data };
}

test('parent registration is invite-gated and single-use; generated secrets are hashed at rest', async t => {
  const f = await fixture(t);
  assert.equal(f.parent.user.role, 'parent');
  assert.match(f.parent.signInCode, /^(?:[a-f0-9]{8}-){4}[a-f0-9]{8}$/);
  assert.notEqual(f.parent.signInCode, f.parent.recoveryCode);
  const stored = await f.db.prepare('SELECT * FROM users').first();
  assert.match(stored.code_hash, /^[a-f0-9]{64}$/);
  assert(!JSON.stringify(stored).includes(f.parent.signInCode));
  assert(!JSON.stringify(stored).includes(f.parent.recoveryCode));
  const again = await f.api('/v1/parent/register', { method: 'POST', body: { username: 'second.parent', setupCode } });
  assert.equal(again.status, 409);
  const bad = await f.api('/v1/parent/register', { method: 'POST', body: { username: 'second.parent', setupCode: 'bad' } });
  assert.equal(bad.status, 401);
});

test('sign-in, session expiration, logout and authorization boundaries', async t => {
  const f = await fixture(t), a = await learner(f), b = await learner(f, 'learner.two');
  assert.equal((await f.api('/v1/me', { token: a.token })).data.user.id, a.user.id);
  assert.equal((await f.api('/v1/learners', { token: a.token })).status, 403);
  assert.equal((await f.api(`/v1/learners/${b.user.id}/progress`, { token: a.token })).status, 403);
  assert.equal((await f.api('/v1/progress', { token: f.parent.token })).status, 403);
  assert.equal((await f.api('/v1/me')).status, 401);
  await f.db.prepare('UPDATE sessions SET expires_at=0 WHERE user_id=?').bind(a.user.id).run();
  assert.equal((await f.api('/v1/me', { token: a.token })).status, 401);
  assert.equal((await f.api('/v1/auth/logout', { method: 'POST', token: b.token })).status, 200);
  assert.equal((await f.api('/v1/me', { token: b.token })).status, 401);
});

test('parent reset and disable revoke learner sessions; recovery is one-time and revokes parent sessions', async t => {
  const f = await fixture(t), a = await learner(f);
  const reset = await f.api(`/v1/learners/${a.user.id}/reset-code`, { method: 'POST', token: f.parent.token });
  assert.equal(reset.status, 200);
  assert.equal((await f.api('/v1/me', { token: a.token })).status, 401);
  assert.equal((await f.api('/v1/auth/login', { method: 'POST', body: { username: a.user.username, code: a.signInCode } })).status, 401);
  const fresh = await f.api('/v1/auth/login', { method: 'POST', body: { username: a.user.username, code: reset.data.signInCode } });
  assert.equal(fresh.status, 200);
  assert.equal((await f.api(`/v1/learners/${a.user.id}`, { method: 'PATCH', token: f.parent.token, body: { disabled: true } })).status, 200);
  assert.equal((await f.api('/v1/me', { token: fresh.data.token })).status, 401);
  assert.equal((await f.api('/v1/auth/login', { method: 'POST', body: { username: a.user.username, code: reset.data.signInCode } })).status, 401);
  const recovered = await f.api('/v1/auth/recover', { method: 'POST', body: { username: f.parent.user.username, recoveryCode: f.parent.recoveryCode } });
  assert.equal(recovered.status, 200);
  assert.equal((await f.api('/v1/me', { token: f.parent.token })).status, 401);
  assert.equal((await f.api('/v1/auth/recover', { method: 'POST', body: { username: f.parent.user.username, recoveryCode: f.parent.recoveryCode } })).status, 401);
  assert.equal((await f.api('/v1/me', { token: recovered.data.token })).status, 200);
});

test('progress synchronizes between sessions, rejects stale and concurrent writes, and stays isolated', async t => {
  const f = await fixture(t), a = await learner(f), b = await learner(f, 'learner.two');
  const initial = await f.api('/v1/progress', { token: a.token });
  assert.deepEqual(initial.data, { revision: 0, data: {}, updatedAt: null });
  const data = { 'vaDone.v1': '[0,2]', 'vaLang.v1': 'zh', 'vaFlashSrs.v2': '{"schemaVersion":2,"scheduler":"fsrs","cards":{}}' };
  const saved = await f.api('/v1/progress', { method: 'PUT', token: a.token, body: { revision: 0, data } });
  assert.equal(saved.status, 200); assert.equal(saved.data.revision, 1);
  const second = await f.api('/v1/auth/login', { method: 'POST', body: { username: a.user.username, code: a.signInCode } });
  assert.deepEqual((await f.api('/v1/progress', { token: second.data.token })).data.data, data);
  assert.deepEqual((await f.api('/v1/progress', { token: b.token })).data.data, {});
  assert.deepEqual((await f.api(`/v1/learners/${a.user.id}/progress`, { token: f.parent.token })).data.data, data);
  const writes = await Promise.all([0,1].map(i => f.api('/v1/progress', { method: 'PUT', token: a.token, body: { revision: 1, data: { 'vaDone.v1': JSON.stringify([i]) } } })));
  assert.deepEqual(writes.map(w => w.status).sort(), [200,409]);
  assert.equal((await f.api('/v1/progress', { token: a.token })).data.revision, 2);
  const stale = await f.api('/v1/progress', { method: 'PUT', token: a.token, body: { revision: 0, data: {} } });
  assert.equal(stale.status, 409); assert.equal(stale.data.error.currentRevision, 2);
});

test('parent cannot access another family’s learner', async t => {
  const f = await fixture(t), a = await learner(f);
  await f.db.prepare("INSERT INTO users(id,username,display_name,role,code_hash,created_at) VALUES ('00000000-0000-0000-0000-000000000001','other.parent','Other','parent','unused',0)").run();
  await f.db.prepare('UPDATE users SET parent_id=? WHERE id=?').bind('00000000-0000-0000-0000-000000000001', a.user.id).run();
  assert.equal((await f.api(`/v1/learners/${a.user.id}/progress`, { token: f.parent.token })).status, 404);
  assert.equal((await f.api(`/v1/learners/${a.user.id}/reset-code`, { method: 'POST', token: f.parent.token })).status, 404);
});

test('rejects malicious, malformed, excessive, or account-containing progress without replacing saved data', async t => {
  const f = await fixture(t), a = await learner(f);
  const invalid = [
    { 'vaProfiles.v1': '{}' }, { 'vaCloudToken': 'secret' }, { 'vaDone.v1': '[-1]' },
    { 'vaDone.v1': '[0.5]' }, { 'vaLang.v1': 'xx' }, { 'vaLastLesson.v1': '999' },
    { 'vaPractice.v1': '{"text":"<img src=x onerror=alert(1)>"}' },
    { 'vaPractice.v1': '{"text":"<img src=x onerror=alert(1)"}' },
    { 'vaPractice.v1': '{"text":"<svg/onload=alert(1)"}' },
    { 'vaPractice.v1': '{"__proto__":{"polluted":true}}' },
    { 'vaPractice.v1': '[]' }, { 'vaPractice.v1': '{' },
  ];
  for (const data of invalid) assert.equal((await f.api('/v1/progress', { method: 'PUT', token: a.token, body: { revision: 0, data } })).status, 400);
  assert.equal((await f.api('/v1/progress', { method: 'PUT', token: a.token, rawBody: 'x'.repeat(1200 * 1024) })).status, 413);
  assert.equal((await f.api('/v1/progress', { token: a.token })).data.revision, 0);
  const plainMath = { 'vaPractice.v1': JSON.stringify({ text: 'x < y; 2 < 3; y > 0; 1/2 = 0.5' }) };
  assert.equal((await f.api('/v1/progress', { method: 'PUT', token: a.token, body: { revision: 0, data: plainMath } })).status, 200);
});

test('trusted-origin CORS and persistent per-user login rate limits', async t => {
  const f = await fixture(t);
  const denied = await f.api('/v1/me', { token: f.parent.token, requestOrigin: 'https://untrusted.example' });
  assert.equal(denied.status, 403); assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
  const preflight = await f.api('/v1/me', { method: 'OPTIONS' });
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
  for (let i = 0; i < 10; i++) assert.equal((await f.api('/v1/auth/login', { method: 'POST', body: { username: 'test.parent', code: 'wrong' } })).status, 401);
  const limited = await f.api('/v1/auth/login', { method: 'POST', body: { username: 'test.parent', code: f.parent.signInCode } });
  assert.equal(limited.status, 429); assert(Number(limited.headers.get('Retry-After')) > 0);
});

test('learner creation has a hard household cap and validates names', async t => {
  const f = await fixture(t);
  assert.equal((await f.api('/v1/learners', { method: 'POST', token: f.parent.token, body: { username: 'bad.user', displayName: '<svg>' } })).status, 400);
  for (let i = 0; i < 12; i++) assert.equal((await f.api('/v1/learners', { method: 'POST', token: f.parent.token, body: { username: 'child.' + i, displayName: 'Child ' + i } })).status, 200);
  assert.equal((await f.api('/v1/learners', { method: 'POST', token: f.parent.token, body: { username: 'child.extra', displayName: 'Extra' } })).status, 409);
});

test('the observed live-site QA profile round-trips without losing exams, writing, review or settings', async t => {
  const f = await fixture(t), a = await learner(f);
  const observed = JSON.parse(await readFile(new URL('./fixtures/observed-progress.json', import.meta.url), 'utf8'));
  assert.deepEqual(observed.excludedLocalOnlyKeys, ['vaBackup.v1']);
  const capabilities = (await f.api('/v1/me', { token: a.token })).data;
  for (const key of Object.keys(observed.data)) assert(capabilities.progressKeys.includes(key), key + ' must be supported');
  assert(Object.hasOwn(observed.data, 'vaSolExam.v1'));
  assert(Object.hasOwn(observed.data, 'va-ll:f08:v1'));
  assert(Object.hasOwn(observed.data, 'va-ll:f09:v1'));
  const saved = await f.api('/v1/progress', { method: 'PUT', token: a.token, body: { revision: 0, data: observed.data } });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  const loaded = await f.api('/v1/progress', { token: a.token });
  assert.deepEqual(loaded.data.data, observed.data);
});

test('the actual local preview process retains credentials, sessions and progress after a clean restart', async t => {
  const stateDir = await mkdtemp(join(tmpdir(), 'va-accounts-restart-'));
  let server;
  async function stop() {
    if (!server || server.exitCode !== null) return;
    const exited = once(server, 'exit'); server.kill('SIGTERM'); await exited;
  }
  t.after(async () => { await stop(); await rm(stateDir, { recursive: true, force: true }); });
  async function start() {
    server = spawn(process.execPath, ['dev.mjs'], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      env: { ...process.env, PORT: '0', VA_LOCAL_STATE_DIR: stateDir, LOCAL_SITE_ORIGIN: origin },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return await new Promise((resolve, reject) => {
      let output = ''; let errors = '';
      const timeout = setTimeout(() => reject(new Error('Preview did not start: ' + errors)), 15000);
      server.stdout.on('data', chunk => {
        output += chunk;
        const match = /Local account API: (http:\/\/[^\s]+)/.exec(output);
        if (match) { clearTimeout(timeout); resolve(match[1]); }
      });
      server.stderr.on('data', chunk => { errors += chunk; });
      server.once('error', error => { clearTimeout(timeout); reject(error); });
      server.once('exit', code => { clearTimeout(timeout); reject(new Error('Preview exited ' + code + ': ' + errors)); });
    });
  }
  let base = await start();
  async function call(path, body, token, method = body === undefined ? 'GET' : 'POST') {
    const headers = { Origin: origin, 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const response = await fetch(new URL(path, base), { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }
  const parent = await call('/v1/parent/register', { username: 'restart.parent', setupCode: 'local-preview-0123456789abcdef0123456789abcdef' });
  assert.equal(parent.status, 200);
  const child = await call('/v1/learners', { username: 'restart.child', displayName: 'Restart test' }, parent.data.token);
  assert.equal(child.status, 200);
  const login = await call('/v1/auth/login', { username: 'restart.child', code: child.data.signInCode });
  assert.equal(login.status, 200);
  const data = { 'vaDone.v1': '[0,3]', 'vaLang.v1': 'zh' };
  assert.equal((await call('/v1/progress', { revision: 0, data }, login.data.token, 'PUT')).status, 200);
  await stop();
  base = await start();
  assert.equal((await call('/v1/me', undefined, parent.data.token)).status, 200, 'session must survive a restart');
  const signedAgain = await call('/v1/auth/login', { username: 'restart.child', code: child.data.signInCode });
  assert.equal(signedAgain.status, 200, 'original sign-in code must still work');
  const restored = await call('/v1/progress', undefined, signedAgain.data.token);
  assert.equal(restored.data.revision, 1);
  assert.deepEqual(restored.data.data, data);
});
