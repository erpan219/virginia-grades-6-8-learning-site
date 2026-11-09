/* Run: node --test enhancements/tests/accounts.test.cjs
   Small VM/DOM fakes exercise persistence and account decisions without
   credentials, a server, dependencies, or production test hooks. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname, '..', 'accounts.js'), 'utf8');
const endpoint = 'http://127.0.0.1:8787';
const REG = 'vaProfiles.v1', META = 'learningCloud.bindings.v1', SESSION = 'learningCloud.session.v1';
const CLOUD_KEY = endpoint + '|learner-1';

function harness(options = {}) {
  class Storage {
    constructor() { this.data = new Map(); }
    getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
    setItem(key, value) { this.data.set(key, String(value)); }
    removeItem(key) { this.data.delete(key); }
  }
  const localStorage = new Storage(), sessionStorage = new Storage();
  let document;
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.listeners = {}; this.isConnected = true; this.classList = { contains() { return false; }, toggle() {} }; }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    append(...children) { children.forEach(child => { child.parentElement = this; this.children.push(child); }); }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    dispatch(type, event = {}) { (this.listeners[type] || []).forEach(fn => fn({ preventDefault() {}, ...event })); }
    focus() { document.activeElement = this; }
    close() { this.open = false; this.dispatch('close'); }
    remove() { this.isConnected = false; if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); }
    showModal() {
      this.open = true;
      if (options.autoDecision !== undefined) queueMicrotask(() => {
        const actions = this.children.find(child => child.attrs.class === 'lac-actions');
        actions.children[options.autoDecision ? 1 : 0].dispatch('click');
      });
    }
  }
  document = { readyState: 'loading', documentElement: { lang: 'en' }, body: new Element('body'), createElement: tag => new Element(tag), getElementById() { return null; } };
  const trigger = new Element('button'); trigger.focus();
  const profile = { id: 'cloud-1', displayName: 'Cloud learner', createdAt: '2026-11-09' };
  const local = { id: 'local-1', displayName: 'Local learner' };
  localStorage.setItem(REG, JSON.stringify({ schemaVersion: 1, activeProfileId: profile.id, revision: 2,
    profiles: options.noLocal ? [profile] : [local, profile], pendingDeleteProfileIds: [] }));
  localStorage.setItem('vaProgress.v1', '{"score":7}');
  localStorage.setItem('vaP_cloud-1__vaProgress.v1', '{"score":7}');
  localStorage.setItem('vaP_local-1__vaProgress.v1', '{"score":2}');
  const binding = { profileId: profile.id, previousProfileId: local.id, revision: 3, lastHash: 'old-hash', pending: true };
  localStorage.setItem(META, JSON.stringify({ [CLOUD_KEY]: binding }));
  sessionStorage.setItem(SESSION, '{"token":"synthetic-token"}');
  let reloads = 0, network = [], timers = new Map(), nextTimer = 0;
  const VP = { REG, boot: { mode: 'profile', activeId: profile.id },
    readReg: () => JSON.parse(localStorage.getItem(REG)), rawGet: key => localStorage.getItem(key),
    rawSet: (key, value) => { if ((options.failRegistry && key === REG) || (options.failNamespace && key.startsWith('vaP_'))) throw Error('full'); localStorage.setItem(key, value); },
    rawRem: key => localStorage.removeItem(key), allKeys: () => [...localStorage.data.keys()],
    isLogical: key => key.startsWith('va') && !key.startsWith('vaP_') && key !== REG };
  const window = { VA_ACCOUNT_CONFIG: { apiBase: endpoint }, addEventListener() {} };
  const crypto = { randomUUID: () => webcrypto.randomUUID(), subtle: { digest: async (...args) => {
    const value = await webcrypto.subtle.digest(...args); if (options.afterDigest) options.afterDigest(); return value;
  } } };
  const context = { window, document, localStorage, sessionStorage, Storage, URL, TextEncoder, crypto, AbortController, TypeError,
    navigator: { onLine: true, locks: { request: async (_name, fn) => fn() } },
    setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); },
    location: { reload() { reloads++; } },
    fetch: async (url, init) => { network.push({ url, init }); if (options.fetch) return options.fetch(url, init); throw new TypeError('offline'); } };
  vm.createContext(context);
  const hook = 'window.test = {state, localSignOut, resumeDeviceCopy, bindActiveDeviceCopy, bindings, confirmAction, activate, save, api, capture, fingerprint, stable, validateSnapshot, syncPresentation, inspectRemote, queueSave, setVP:function(value){VP=value;}};';
  vm.runInContext(source.replace("  if (document.readyState === 'complete') init();", hook + "\n  if (document.readyState === 'complete') init();"), context);
  const api = window.test; api.setVP(VP);
  Object.assign(api.state, { session: { token: 'synthetic-token', user: { id: 'learner-1', role: 'learner' } },
    target: { id: 'learner-1', username: 'synthetic_learner', displayName: 'Cloud learner' },
    binding, keys: ['vaProgress.v1', 'va-ll:f08:v1'], ready: true, pending: true });
  return { api, VP, localStorage, sessionStorage, document, navigator: context.navigator, trigger, network, timers, get reloads() { return reloads; } };
}
const response = (status, value) => ({ ok: status >= 200 && status < 300, status, json: async () => value });

// Account decisions must remain ordinary accessible DOM, not native JS dialogs.
test('confirmation dialog explains action, focuses Cancel, dismisses on Escape, and restores focus', async () => {
  const h = harness();
  const result = h.api.confirmAction('Replacing a copy does not merge histories.', 'Replace cloud save');
  const dialog = h.document.body.children[0], actions = dialog.children[2];
  assert.equal(dialog.tagName, 'DIALOG'); assert.equal(dialog.attrs['aria-labelledby'], 'lac-confirm-title');
  assert.equal(dialog.attrs['aria-describedby'], 'lac-confirm-description');
  assert.equal(dialog.children[1].textContent, 'Replacing a copy does not merge histories.');
  assert.equal(h.document.activeElement, actions.children[0]);
  dialog.dispatch('cancel'); assert.equal(await result, false);
  assert.equal(h.document.activeElement, h.trigger); assert.equal(h.document.body.children.length, 0);
  assert(!/\bconfirm\(/.test(source), 'account decisions must not call window.confirm');
});
test('confirmation requires explicit affirmative action', async () => {
  const h = harness(); const result = h.api.confirmAction('Save consequence.', 'Confirm change');
  h.document.body.children[0].children[2].children[1].dispatch('click');
  assert.equal(await result, true); assert.equal(h.document.activeElement, h.trigger);
});

test('offline local sign-out parks unsynced namespace outside learner registry and clears token', async () => {
  const h = harness({ autoDecision: true }); await h.api.localSignOut();
  const registry = h.VP.readReg(), binding = h.api.bindings()[CLOUD_KEY];
  assert.equal(h.network.length, 0); assert.equal(h.sessionStorage.getItem(SESSION), null);
  assert.equal(registry.activeProfileId, 'local-1'); assert.deepEqual(registry.profiles.map(p => p.id), ['local-1']);
  assert(!registry.pendingDeleteProfileIds.includes('cloud-1'));
  assert.equal(h.localStorage.getItem('vaP_cloud-1__vaProgress.v1'), '{"score":7}');
  assert.equal(h.localStorage.getItem('vaP_local-1__vaProgress.v1'), '{"score":2}');
  assert(binding.parked && binding.pending && binding.profile.id === 'cloud-1'); assert.equal(h.reloads, 1);
});
test('parked copy resumes only after authentication and cloud check', async () => {
  const h = harness({ autoDecision: true }); await h.api.localSignOut();
  await assert.rejects(() => h.api.resumeDeviceCopy(), /sign_in_required/);
  h.VP.boot.activeId = 'local-1';
  Object.assign(h.api.state, { binding: h.api.bindings()[CLOUD_KEY], ready: true,
    session: { token: 'new-synthetic-token', user: { id: 'learner-1', role: 'learner' } }, remote: { revision: 3, data: {} } });
  await h.api.resumeDeviceCopy();
  assert.equal(h.VP.readReg().activeProfileId, 'cloud-1');
  assert.equal(h.api.bindings()[CLOUD_KEY].parked, false);
  assert.equal(h.api.bindings()[CLOUD_KEY].previousProfileId, 'local-1');
  assert.equal(h.localStorage.getItem('vaP_cloud-1__vaProgress.v1'), '{"score":7}');
});
test('cancelled sign-out does not change authentication or learner', async () => {
  const h = harness({ autoDecision: false }); await h.api.localSignOut();
  assert.equal(h.reloads, 0); assert(h.sessionStorage.getItem(SESSION)); assert.equal(h.VP.readReg().activeProfileId, 'cloud-1');
});
test('local sign-out creates a local fallback if previous learner no longer exists', async () => {
  const h = harness({ autoDecision: true, noLocal: true }); await h.api.localSignOut();
  assert.notEqual(h.VP.readReg().activeProfileId, 'cloud-1'); assert.equal(h.VP.readReg().profiles.length, 1);
});
test('failed registry write clears bearer while preserving progress and original registry', async () => {
  const h = harness({ autoDecision: true, failRegistry: true });
  await assert.rejects(() => h.api.localSignOut(), /local_storage/);
  assert.equal(h.sessionStorage.getItem(SESSION), null); assert.equal(h.VP.readReg().activeProfileId, 'cloud-1');
  assert.equal(h.localStorage.getItem('vaP_cloud-1__vaProgress.v1'), '{"score":7}'); assert.equal(h.reloads, 0);
});
test('closed/expired tab can identify its active account copy without retaining credentials', () => {
  const h = harness(); h.api.state.binding = null; h.api.state.target = null; h.api.state.session = null;
  h.api.bindActiveDeviceCopy(); assert.equal(h.api.state.binding.profileId, 'cloud-1'); assert.equal(h.api.state.target.id, 'learner-1');
  assert.equal(h.api.state.session, null);
});

test('snapshots map profile-scoped writing keys and exclude credentials/metadata', async () => {
  const h = harness(); h.localStorage.setItem('va-ll:f08:v1:profile:cloud-1', '{"draft":"example"}');
  const snapshot = h.api.capture('cloud-1', true);
  assert.equal(snapshot['va-ll:f08:v1'], '{"draft":"example"}');
  assert.deepEqual(Object.keys(snapshot).sort(), ['va-ll:f08:v1', 'vaProgress.v1']);
  assert.equal(await h.api.fingerprint({ b: '2', a: '1' }), await h.api.fingerprint({ a: '1', b: '2' }));
  assert.throws(() => h.api.validateSnapshot({ revision: 1, data: { token: 'secret' } }), /invalid_snapshot/);
});
test('save uses revision compare-and-swap and marks only server-confirmed progress saved', async () => {
  const h = harness({ fetch: async (_url, init) => { assert.equal(JSON.parse(init.body).revision, 3); return response(200, { revision: 4, updatedAt: '2026-11-09' }); } });
  assert.equal(await h.api.save(false), true); assert.equal(h.api.state.binding.revision, 4);
  assert.equal(h.api.state.pending, false); assert.equal(h.api.bindings()[CLOUD_KEY].pending, false);
  assert.equal(h.api.syncPresentation().text, 'Saved to your account');
  assert.equal(h.network[0].init.headers.Authorization, 'Bearer synthetic-token');
});
test('revision conflict preserves device history and does not advance stored revision', async () => {
  const h = harness({ fetch: async (_url, init) => init.method === 'PUT' ? response(409, { error: { code: 'revision_conflict' } }) : response(200, { revision: 5, data: { 'vaProgress.v1': '{"score":9}' } }) });
  await assert.rejects(() => h.api.save(false), /revision_conflict/);
  assert.equal(h.api.state.conflict, true); assert.equal(h.api.state.binding.revision, 3); assert.equal(h.api.state.pending, true);
  assert.equal(h.localStorage.getItem('vaProgress.v1'), '{"score":7}'); assert.equal(h.api.state.remote.revision, 5);
  assert.equal(h.api.syncPresentation().text, 'Sync needs attention');
});
test('offline save keeps pending data locally', async () => {
  const h = harness(); await assert.rejects(() => h.api.save(false), /network/);
  assert.equal(h.api.state.pending, true); assert.equal(h.api.bindings()[CLOUD_KEY].pending, true);
  assert.equal(h.localStorage.getItem('vaProgress.v1'), '{"score":7}');
  assert.equal(h.api.syncPresentation().text, 'Could not sync — retry');
  h.navigator.onLine = false;
  assert.equal(h.api.syncPresentation().text, 'Offline — waiting to sync');
  h.api.queueSave(); assert.equal(h.timers.size, 0, 'known offline state waits for reconnection');
});
test('new edits during save remain pending after acknowledgement', async () => {
  let h; h = harness({ fetch: async () => { h.localStorage.setItem('vaProgress.v1', '{"score":8}'); return response(200, { revision: 4 }); } });
  assert.equal(await h.api.save(false), false); assert.equal(h.api.state.pending, true); assert.equal(h.api.bindings()[CLOUD_KEY].pending, true);
  assert.equal(h.api.syncPresentation().text, 'Syncing…');
});
test('expired authentication removes token without deleting study data', async () => {
  const h = harness({ fetch: async () => response(401, { error: { code: 'sign_in_required' } }) });
  await assert.rejects(() => h.api.api('/v1/me'), /sign_in_required/);
  assert.equal(h.sessionStorage.getItem(SESSION), null); assert.equal(h.api.state.session, null);
  assert.equal(h.localStorage.getItem('vaProgress.v1'), '{"score":7}');
  assert.equal(h.api.syncPresentation().text, 'Sign in to resume syncing');
});

test('authentication and a cached clean flag do not claim a cloud save before remote verification', async () => {
  let release, started; const requestStarted = new Promise(resolve => { started = resolve; });
  const h = harness({ fetch: async () => { started(); return new Promise(resolve => { release = resolve; }); } });
  h.api.state.pending = false;
  h.api.state.binding.lastHash = await h.api.fingerprint(h.api.capture('cloud-1', true));
  assert.equal(h.api.syncPresentation().text, 'Checking account save…');
  const check = h.api.inspectRemote(); await requestStarted;
  assert.equal(h.api.syncPresentation().text, 'Checking account save…');
  release(response(200, { revision: 3, data: { 'vaProgress.v1': '{"score":7}' } })); await check;
  assert.equal(h.api.syncPresentation().text, 'Saved to your account');
  h.api.state.remote.revision = 4;
  assert.equal(h.api.syncPresentation().text, 'Newer account save available');
});
test('in-flight save stays syncing until server acknowledgement, including translated status', async () => {
  let release, started; const requestStarted = new Promise(resolve => { started = resolve; });
  const h = harness({ fetch: async () => { started(); return new Promise(resolve => { release = resolve; }); } });
  const saving = h.api.save(false); await requestStarted;
  assert.equal(h.api.syncPresentation().text, 'Syncing…');
  h.document.documentElement.lang = 'zh-CN';
  assert.equal(h.api.syncPresentation().text, '正在同步…');
  release(response(200, { revision: 4 })); await saving;
  assert.equal(h.api.syncPresentation().text, '已保存到你的账户');
});
test('signed-in local profiles retain device wording and failed cloud rechecks revoke confirmed status', async () => {
  const h = harness();
  Object.assign(h.api.state, { pending: false, syncChecked: true, remote: { revision: 3, data: {} } });
  assert.equal(h.api.syncPresentation().text, 'Saved to your account');
  await assert.rejects(() => h.api.inspectRemote(), /network/);
  assert.equal(h.api.syncPresentation().text, 'Could not sync — retry');
  h.VP.boot.activeId = 'local-1';
  assert.equal(h.api.syncPresentation().text, 'Saved on this device');
});
test('an edit during asynchronous cloud comparison cannot be labeled saved', async () => {
  let change = false, h;
  h = harness({ fetch: async () => response(200, { revision: 3, data: { 'vaProgress.v1': '{"score":7}' } }),
    afterDigest: () => { if (change) { change = false; h.localStorage.setItem('vaProgress.v1', '{"score":8}'); } } });
  h.api.state.binding.lastHash = await h.api.fingerprint(h.api.capture('cloud-1', true));
  change = true;
  await h.api.inspectRemote();
  assert.equal(h.api.state.pending, true);
  assert.equal(h.api.syncPresentation().text, 'Syncing…');
});
test('an edit during a no-op save check remains pending instead of being labeled saved', async () => {
  let change = false, h;
  h = harness({ afterDigest: () => { if (change) { change = false; h.localStorage.setItem('vaProgress.v1', '{"score":8}'); } } });
  h.api.state.binding.lastHash = await h.api.fingerprint(h.api.capture('cloud-1', true));
  Object.assign(h.api.state, { pending: false, syncChecked: true, remote: { revision: 3, data: {} } });
  change = true;
  assert.equal(await h.api.save(false), false);
  assert.equal(h.api.state.pending, true);
  assert.equal(h.api.bindings()[CLOUD_KEY].pending, true);
  assert.equal(h.api.syncPresentation().text, 'Syncing…');
  assert.equal(h.network.length, 0);
});

test('loading cloud stages a separate namespace and remaps writing IDs without changing local learner data', async () => {
  const h = harness();
  await h.api.activate({ revision: 5, data: { 'vaProgress.v1': '{"score":11}', 'va-ll:f08:v1': '{"draft":"cloud draft"}' } }, false);
  const id = h.VP.readReg().activeProfileId;
  assert.notEqual(id, 'cloud-1'); assert.notEqual(id, 'local-1');
  assert.equal(h.localStorage.getItem('vaP_' + id + '__vaProgress.v1'), '{"score":11}');
  assert.equal(h.localStorage.getItem('vaP_' + id + '__va-ll:f08:v1:profile:' + id), '{"draft":"cloud draft"}');
  assert.equal(h.localStorage.getItem('vaP_local-1__vaProgress.v1'), '{"score":2}');
  assert.equal(h.localStorage.getItem('vaProfileOperation.v1'), null); assert.equal(h.reloads, 1);
});
test('explicit first-run import preserves legacy default-profile writing in both separate profiles', async () => {
  const h = harness({ fetch: async (_url, init) => {
    const body = JSON.parse(init.body); assert.equal(body.revision, 0);
    assert.equal(body.data['va-ll:f08:v1'], '{"draft":"legacy draft"}');
    return response(200, { revision: 1, updatedAt: '2026-11-09' });
  } });
  [...h.localStorage.data.keys()].filter(key => key.startsWith('vaP_') || key === REG || key === META).forEach(key => h.localStorage.removeItem(key));
  h.localStorage.setItem('va-ll:f08:v1:profile:default', '{"draft":"legacy draft"}');
  h.api.state.binding = null; h.VP.boot = { mode: 'migration' };
  await h.api.activate({ revision: 0, data: {} }, true);
  const registry = h.VP.readReg(); assert.equal(registry.profiles.length, 2);
  registry.profiles.forEach(profile => {
    assert.equal(h.localStorage.getItem('vaP_' + profile.id + '__va-ll:f08:v1:profile:' + profile.id), '{"draft":"legacy draft"}');
    assert.equal(h.localStorage.getItem('vaP_' + profile.id + '__vaProgress.v1'), '{"score":7}');
  });
  assert.equal(h.network.length, 1); assert.equal(h.reloads, 1);
});
test('activation storage failure leaves original registry and progress intact', async () => {
  const h = harness({ failNamespace: true }); const originalRegistry = h.localStorage.getItem(REG), originalBinding = h.localStorage.getItem(META);
  await assert.rejects(() => h.api.activate({ revision: 5, data: { 'vaProgress.v1': '{"score":11}' } }, false), /local_storage/);
  assert.equal(h.localStorage.getItem(REG), originalRegistry); assert.equal(h.localStorage.getItem(META), originalBinding);
  assert.equal(h.localStorage.getItem('vaP_cloud-1__vaProgress.v1'), '{"score":7}');
  assert.equal(h.localStorage.getItem('vaProfileOperation.v1'), null); assert.equal(h.reloads, 0);
});
