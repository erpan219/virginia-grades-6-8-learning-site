/* Optional parent-managed accounts. Inert unless VA_ACCOUNT_CONFIG.apiBase is set.
   Credentials are never included in learner progress or localStorage. */
(function () {
  'use strict';
  var cfg = window.VA_ACCOUNT_CONFIG;
  if (!cfg || typeof cfg.apiBase !== 'string' || !cfg.apiBase) return;
  var endpoint;
  try {
    endpoint = new URL(cfg.apiBase);
    var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(endpoint.hostname);
    if (endpoint.protocol !== 'https:' && !(local && endpoint.protocol === 'http:')) return;
    if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) return;
    endpoint = endpoint.href.replace(/\/$/, '');
  } catch (_) { return; }
  var SESSION = 'learningCloud.session.v1', META = 'learningCloud.bindings.v1';
  var VP, panel, home, dialog, timer, watching = false, savePromise;
  var state = { session: null, keys: [], maxBytes: 1048576, target: null, binding: null,
    remote: null, conflict: false, status: '', tone: '', busy: false, mode: 'login',
    secrets: null, learners: [], importing: false, pending: false, ready: false, leaving: false,
    syncChecked: false, saving: false, syncError: null, syncMessage: false };
  function t(en, zh) {
    var lang = document.documentElement.lang;
    return lang.indexOf('zh') === 0 ? zh : (document.body.classList.contains('bi-mode') ? en + ' · ' + zh : en);
  }
  function el(tag, text, attrs) {
    var n = document.createElement(tag);
    if (text != null) n.textContent = text;
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function button(text, fn, primary) {
    var b = el('button', text, { type: 'button', class: 'btn ' + (primary ? 'btn-green' : 'btn-line') });
    b.addEventListener('click', fn); return b;
  }
  function confirmAction(message, action) {
    return new Promise(function (resolve) {
      var previousFocus = document.activeElement, finished = false;
      var box = el('dialog', null, { class: 'lac-confirm', 'aria-labelledby': 'lac-confirm-title', 'aria-describedby': 'lac-confirm-description' });
      box.append(el('h3', action, { id: 'lac-confirm-title' }), el('p', message, { id: 'lac-confirm-description' }));
      function finish(accepted) {
        if (finished) return; finished = true;
        box.close(); box.remove();
        if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus();
        resolve(accepted);
      }
      var actions = el('div', null, { class: 'lac-actions' });
      var cancel = button(t('Cancel', '取消'), function () { finish(false); });
      actions.append(cancel, button(action, function () { finish(true); }, true)); box.append(actions);
      box.addEventListener('cancel', function (event) { event.preventDefault(); finish(false); });
      box.addEventListener('close', function () { finish(false); });
      document.body.append(box); box.showModal(); cancel.focus();
    });
  }
  function readJSON(store, key, fallback) { try { return JSON.parse(store.getItem(key)) || fallback; } catch (_) { return fallback; } }
  function bindings() { var b = readJSON(localStorage, META, {}); return b && typeof b === 'object' && !Array.isArray(b) ? b : {}; }
  function bindingKey(id) { return endpoint + '|' + id; }
  function persistBinding() {
    if (!state.target || !state.binding) return;
    var all = bindings(); all[bindingKey(state.target.id)] = state.binding;
    localStorage.setItem(META, JSON.stringify(all));
  }
  function persistSession() {
    if (!state.session) { sessionStorage.removeItem(SESSION); return; }
    sessionStorage.setItem(SESSION, JSON.stringify({ endpoint: endpoint, token: state.session.token,
      expiresAt: state.session.expiresAt, user: state.session.user, target: state.target }));
  }
  function active() {
    if (!state.binding || !VP || VP.boot.mode !== 'profile') return false;
    var r = VP.readReg();
    return !!r && r !== 'invalid' && r.activeProfileId === state.binding.profileId && VP.boot.activeId === r.activeProfileId;
  }
  function bindActiveDeviceCopy() {
    var reg = VP.readReg();
    if (!reg || reg === 'invalid') return;
    var all = bindings(), key = Object.keys(all).find(function (k) {
      return k.indexOf(endpoint + '|') === 0 && all[k] && all[k].profileId === reg.activeProfileId;
    });
    if (!key) return;
    state.binding = all[key]; state.pending = !!state.binding.pending;
    if (!state.target || state.target.id !== key.slice(endpoint.length + 1)) {
      var profile = reg.profiles.find(function (p) { return p.id === reg.activeProfileId; });
      state.target = { id: key.slice(endpoint.length + 1), displayName: profile && profile.displayName || '' };
    }
  }
  function localKey(wire, profileId) {
    if (wire === 'va-ll:f08:v1' || wire === 'va-ll:f09:v1') return wire + ':profile:' + encodeURIComponent(profileId);
    return wire;
  }
  function isProgressKey(key, profileId) {
    return state.keys.some(function (wire) { return localKey(wire, profileId) === key; });
  }
  function capture(profileId, logical) {
    var out = Object.create(null), prefix = logical ? '' : 'vaP_' + profileId + '__';
    state.keys.forEach(function (wire) {
      var value = VP.rawGet(prefix + localKey(wire, profileId));
      if (value !== null) out[wire] = value;
    });
    return out;
  }
  function stable(data) {
    var ordered = Object.create(null);
    Object.keys(data).sort().forEach(function (key) { ordered[key] = data[key]; });
    return JSON.stringify(ordered);
  }
  async function fingerprint(data) {
    var buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stable(data)));
    return Array.from(new Uint8Array(buffer)).map(function (x) { return x.toString(16).padStart(2, '0'); }).join('');
  }
  function validateSnapshot(record) {
    if (!record || !Number.isInteger(record.revision) || record.revision < 0 || !record.data ||
        typeof record.data !== 'object' || Array.isArray(record.data)) throw new Error('invalid_snapshot');
    Object.keys(record.data).forEach(function (key) {
      if (state.keys.indexOf(key) < 0 || typeof record.data[key] !== 'string') throw new Error('invalid_snapshot');
    });
    if (new TextEncoder().encode(stable(record.data)).byteLength > state.maxBytes) throw new Error('progress_too_large');
    return record;
  }
  function message(error) {
    var code = error.code || error.message;
    var labels = {
      sign_in_required: ['Your session ended. Sign in again; unsaved progress remains on this device.', '登录已过期。请重新登录；未同步的进度仍保存在本机。'],
      invalid_credentials: ['The username or sign-in code was not accepted.', '用户名或登录码不正确。'],
      invalid_username: ['Use 3–32 letters, numbers, dots, underscores or hyphens.', '请使用 3–32 个英文字母、数字、点、下划线或连字符。'],
      invalid_name: ['Use a nickname of 1–60 characters without angle brackets.', '请使用 1–60 个字符的昵称，不含尖括号。'],
      username_taken: ['That username is already in use. Choose another.', '该用户名已被使用，请换一个。'],
      registration_closed: ['The parent account is already set up. Use sign-in or recovery.', '家长账户已创建。请登录或恢复账户。'],
      invalid_setup_code: ['The owner setup code was not accepted.', '站点所有者设置码不正确。'],
      invalid_recovery_code: ['The recovery details were not accepted.', '账户恢复信息不正确。'],
      revision_conflict: ['Another device saved newer progress. Choose which copy to keep below.', '另一台设备已保存较新的进度。请在下方选择保留哪一份。'],
      progress_too_large: ['This progress is too large to sync. Keep a local backup; nothing was discarded.', '进度超过同步大小上限。请保留本地备份；没有丢弃任何数据。'],
      invalid_progress: ['The server could not accept this progress format. Your local progress is unchanged.', '服务器无法接受此进度格式。本地进度未改变。'],
      invalid_snapshot: ['The cloud save could not be read safely. Your local progress is unchanged.', '无法安全读取云端存档。本地进度未改变。'],
      local_changed: ['Progress changed while this action ran. Save again before switching or signing out.', '操作期间进度发生变化。切换或退出前请再次保存。'],
      profile_changed: ['The active learner changed in another tab. Reload before syncing.', '另一标签页切换了学习者。请重新加载后再同步。'],
      local_storage: ['Browser storage is unavailable or full. Nothing was imported. Export a local backup first.', '浏览器存储不可用或已满。未导入数据，请先导出本地备份。'],
      rate_limited: ['Too many attempts. Wait a moment and try again.', '尝试次数过多，请稍后重试。'],
      parent_required: ['A parent account is required for this action.', '此操作需要家长账户。'],
      learner_limit: ['This family has reached its learner limit.', '此家庭已达到学习者数量上限。'],
      network: ['Could not reach cloud storage. Progress stays on this device; reconnect and retry.', '无法连接云端。进度保存在本机；恢复网络后请重试。']
    };
    var pair = labels[code];
    return pair ? t(pair[0], pair[1]) : t('The action could not be completed. Your local progress is preserved. Please retry.', '操作未完成。本地进度已保留，请重试。');
  }
  function setStatus(text, tone) {
    state.syncMessage = false;
    state.status = text; state.tone = tone || '';
    var n = panel && panel.querySelector('.lac-status');
    if (n) { n.textContent = text; n.className = 'lac-status ' + (tone || ''); n.setAttribute('role', tone === 'error' ? 'alert' : 'status'); }
    updateChrome();
  }
  function syncPresentation() {
    if (!active()) return { text: t('Saved on this device', '保存在这台设备上'), tone: '' };
    if (!state.session || !state.ready) return { text: t('Sign in to resume syncing', '请登录以恢复同步'), tone: '' };
    if (state.conflict) return { text: t('Sync needs attention', '同步需要处理'), tone: 'error' };
    if (navigator.onLine === false) return { text: state.pending ? t('Offline — waiting to sync', '已离线 — 等待同步') : t('Offline — sync paused', '已离线 — 同步已暂停'), tone: '' };
    if (state.saving) return { text: t('Syncing…', '正在同步…'), tone: '' };
    if (state.syncError) return { text: t('Could not sync — retry', '无法同步 — 请重试'), tone: 'error' };
    if (!state.syncChecked || !state.remote) return { text: t('Checking account save…', '正在检查账户存档…'), tone: '' };
    if (state.remote.revision !== state.binding.revision) return { text: t('Newer account save available', '有更新的账户存档'), tone: '' };
    if (state.pending) return { text: t('Syncing…', '正在同步…'), tone: '' };
    return { text: t('Saved to your account', '已保存到你的账户'), tone: 'success' };
  }
  function showSyncStatus() {
    var status = syncPresentation();
    setStatus(status.text, status.tone); state.syncMessage = true;
  }
  function fail(error) { setStatus(message(error), 'error'); }
  async function api(path, method, data, anonymous) {
    var headers = { Accept: 'application/json' };
    if (data !== undefined) headers['Content-Type'] = 'application/json';
    if (!anonymous && state.session) headers.Authorization = 'Bearer ' + state.session.token;
    var controller = new AbortController(), timeout = setTimeout(function () { controller.abort(); }, 20000);
    try {
      var res = await fetch(endpoint + path, { method: method || 'GET', headers: headers,
        body: data === undefined ? undefined : JSON.stringify(data), signal: controller.signal,
        cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
      var value; try { value = await res.json(); } catch (_) { throw new Error('network'); }
      if (!res.ok) {
        var err = new Error(value.error && value.error.code || 'network');
        err.code = value.error && value.error.code; err.status = res.status; err.detail = value.error;
        if (res.status === 401 && !anonymous) {
          state.ready = false; state.session = null; persistSession(); render();
        }
        throw err;
      }
      return value;
    } catch (e) { if (e.name === 'AbortError' || e instanceof TypeError) throw new Error('network'); throw e; }
    finally { clearTimeout(timeout); }
  }
  function progressPath() {
    if (!state.session || !state.target) throw new Error('sign_in_required');
    return state.session.user.role === 'parent' ? '/v1/learners/' + encodeURIComponent(state.target.id) + '/progress' : '/v1/progress';
  }
  async function withBusy(fn) {
    if (state.busy) return;
    state.busy = true; panel.setAttribute('aria-busy', 'true');
    try { await fn(); } catch (e) { fail(e); }
    finally { state.busy = false; if (panel) panel.removeAttribute('aria-busy'); }
  }
  async function refreshIdentity() {
    state.syncChecked = false;
    var value = await api('/v1/me');
    if (!value.user || !Array.isArray(value.progressKeys) || !value.progressKeys.length) throw new Error('invalid_snapshot');
    state.session.user = value.user; state.keys = value.progressKeys.slice();
    state.maxBytes = value.maxProgressBytes || 1048576; state.ready = true;
    if (value.user.role === 'learner') state.target = value.user;
    state.binding = state.target ? bindings()[bindingKey(state.target.id)] || null : null;
    persistSession();
    if (value.user.role === 'parent') state.learners = (await api('/v1/learners')).learners || [];
  }
  async function acceptAuth(value) {
    if (!value.token || !value.user || !value.expiresAt) throw new Error('invalid_snapshot');
    state.session = { token: value.token, expiresAt: value.expiresAt, user: value.user };
    state.target = value.user.role === 'learner' ? value.user : null;
    state.remote = null; state.binding = null; state.conflict = false; state.importing = false; state.pending = false;
    state.syncChecked = false; state.syncError = null;
    persistSession();
    state.secrets = value.signInCode ? { username: value.user.username, signInCode: value.signInCode, recoveryCode: value.recoveryCode } : null;
    await refreshIdentity();
    setStatus(t('Signed in. Choose a learner or open the saved progress below.', '已登录。请选择学习者或打开下方已保存的进度。'));
    render();
  }
  async function inspectRemote() {
    state.syncChecked = false; state.syncError = null; updateChrome();
    try {
      state.remote = validateSnapshot(await api(progressPath()));
      if (active()) {
        var current = capture(state.binding.profileId, true), hash = await fingerprint(current);
        state.pending = hash !== state.binding.lastHash || stable(current) !== stable(capture(state.binding.profileId, true));
        state.binding.pending = state.pending;
        state.conflict = state.pending && state.remote.revision !== state.binding.revision;
        persistBinding(); state.syncChecked = true;
        if (state.conflict) setStatus(message(new Error('revision_conflict')), 'error');
        else if (state.remote.revision !== state.binding.revision) setStatus(t('A newer cloud save is available. Load it below to continue on this device.', '有更新的云端存档。请在下方加载后继续。'));
        else { showSyncStatus(); if (state.pending) queueSave(); }
      }
      render();
    } catch (e) { state.syncError = e.code || e.message; updateChrome(); throw e; }
  }
  async function save(force) {
    if (savePromise) return savePromise;
    if (!active()) throw new Error('profile_changed');
    if (!state.ready) throw new Error('sign_in_required');
    if (state.conflict && !force) throw new Error('revision_conflict');
    savePromise = (async function () {
      var data = capture(state.binding.profileId, true), hash = await fingerprint(data);
      if (hash === state.binding.lastHash && !force) {
        state.pending = stable(data) !== stable(capture(state.binding.profileId, true));
        state.binding.pending = state.pending; persistBinding(); showSyncStatus();
        if (state.pending) queueSave();
        return !state.pending;
      }
      state.saving = true; state.syncError = null; showSyncStatus();
      var expected = force && state.remote ? state.remote.revision : state.binding.revision;
      try {
        var saved = await api(progressPath(), 'PUT', { revision: expected, data: data });
        if (!Number.isInteger(saved.revision)) throw new Error('invalid_snapshot');
        state.binding.revision = saved.revision; state.binding.lastHash = hash; state.binding.updatedAt = saved.updatedAt;
        state.remote = { revision: saved.revision, data: data, updatedAt: saved.updatedAt };
        state.conflict = false;
        var latest = capture(state.binding.profileId, true), latestHash = await fingerprint(latest);
        state.pending = latestHash !== hash || stable(latest) !== stable(capture(state.binding.profileId, true));
        state.binding.pending = state.pending; persistBinding();
        state.syncChecked = true; state.saving = false; showSyncStatus();
        if (state.pending) queueSave();
        return !state.pending;
      } catch (e) {
        state.saving = false; state.syncError = e.code || e.message;
        state.pending = true; state.binding.pending = true; persistBinding();
        if (e.status === 409) { state.conflict = true; state.remote = validateSnapshot(await api(progressPath())); render(); }
        fail(e); throw e;
      }
    })();
    try { return await savePromise; } finally { savePromise = null; state.saving = false; updateChrome(); }
  }
  function queueSave() {
    clearTimeout(timer);
    if (state.leaving || state.conflict || !state.ready || !active() || navigator.onLine === false) return;
    timer = setTimeout(function () { save(false).catch(function () {}); }, 1800);
  }
  function lock(fn) {
    return navigator.locks && navigator.locks.request ? navigator.locks.request('va-learning-storage.v1', fn) : Promise.resolve().then(fn);
  }
  function uuid() { return crypto.randomUUID(); }
  async function activate(record, importLocal) {
    validateSnapshot(record);
    if (VP.readReg() === 'invalid') throw new Error('local_storage');
    var data = record.data, id = state.binding && state.binding.profileId || uuid();
    var previous = VP.readReg(), previousId = previous && previous.activeProfileId;
    if (importLocal) {
      if (record.revision !== 0 || Object.keys(record.data).length) throw new Error('revision_conflict');
      data = capture(previousId || 'default', true);
      var imported = await api(progressPath(), 'PUT', { revision: 0, data: data });
      record = { data: data, revision: imported.revision, updatedAt: imported.updatedAt };
    }
    var hash = await fingerprint(data), now = new Date().toISOString();
    await lock(function () {
      var reg = VP.readReg();
      if (reg === 'invalid' || (previous && (!reg || reg.revision !== previous.revision || reg.activeProfileId !== previousId))) throw new Error('profile_changed');
      var fallback, newProfiles = [], op = uuid(), originalMeta = localStorage.getItem(META), committed = false;
      if (!reg) {
        fallback = { id: uuid(), displayName: t('Local learner', '本地学习者'), createdAt: now, updatedAt: now };
        previousId = fallback.id;
        reg = { schemaVersion: 1, revision: 0, activeProfileId: previousId, profiles: [fallback], pendingDeleteProfileIds: [] };
        newProfiles.push(fallback);
      }
      var existing = reg.profiles.find(function (p) { return p.id === id; });
      /* Loading a newer save gets a fresh namespace; the old copy is kept
         until registry commit, so a storage failure cannot erase it. */
      var oldCloudId = existing ? id : null;
      if (existing) id = uuid();
      var profile = { id: id, displayName: state.target.displayName || state.target.username, createdAt: now, updatedAt: now };
      newProfiles.push(profile);
      VP.rawSet('vaProfileOperation.v1', JSON.stringify({ schemaVersion: 1, operationId: op, kind: 'cloud-activate',
        startedAt: now, baseRevision: reg.revision, phase: 'staging', stagedProfiles: newProfiles.map(function (p) { return { profile: p }; }) }));
      try {
        if (fallback) VP.allKeys().filter(VP.isLogical).forEach(function (key) {
          var value = VP.rawGet(key); VP.rawSet('vaP_' + fallback.id + '__' + key, value);
          ['va-ll:f08:v1', 'va-ll:f09:v1'].forEach(function (wire) {
            if (key === localKey(wire, 'default')) VP.rawSet('vaP_' + fallback.id + '__' + localKey(wire, fallback.id), value);
          });
        });
        Object.keys(data).forEach(function (key) { VP.rawSet('vaP_' + id + '__' + localKey(key, id), data[key]); });
        Object.keys(data).forEach(function (key) { if (VP.rawGet('vaP_' + id + '__' + localKey(key, id)) !== data[key]) throw new Error('local_storage'); });
        var previousBinding = Object.values(bindings()).find(function (b) { return b && b.profileId === previousId; });
        var prevLocal = state.binding && state.binding.previousProfileId || previousBinding && previousBinding.previousProfileId || previousId;
        if (oldCloudId && prevLocal === oldCloudId) {
          var other = reg.profiles.find(function (p) { return p.id !== oldCloudId; });
          if (!other) throw new Error('local_storage');
          prevLocal = other.id;
        }
        state.binding = { profileId: id, previousProfileId: prevLocal, revision: record.revision, lastHash: hash, pending: false, updatedAt: record.updatedAt };
        persistBinding();
        reg.profiles = reg.profiles.filter(function (p) { return p.id !== oldCloudId; }).concat(profile);
        reg.activeProfileId = id; reg.revision = (reg.revision || 0) + 1; reg.lastTransactionId = op;
        if (oldCloudId) reg.pendingDeleteProfileIds = (reg.pendingDeleteProfileIds || []).concat(oldCloudId);
        VP.rawSet(VP.REG, JSON.stringify(reg)); committed = true;
        VP.rawRem('vaProfileOperation.v1'); persistSession();
      } catch (e) {
        /* Once registry commit succeeds, keep the verified namespace.
           A sessionStorage failure must never delete the active profile. */
        if (committed) { location.reload(); return; }
        if (originalMeta === null) localStorage.removeItem(META); else localStorage.setItem(META, originalMeta);
        newProfiles.forEach(function (p) { VP.allKeys().forEach(function (k) { if (k.indexOf('vaP_' + p.id + '__') === 0) VP.rawRem(k); }); });
        VP.rawRem('vaProfileOperation.v1'); throw new Error('local_storage');
      }
    });
    location.reload();
  }
  function downloadBackup() {
    if (!state.binding) return;
    var blob = new Blob([JSON.stringify({ format: 'va-account-progress-copy', schemaVersion: 1,
      username: state.target.username, exportedAt: new Date().toISOString(), revision: state.binding.revision,
      data: capture(state.binding.profileId, active()) }, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob), a = el('a', '', { href: url, download: 'learning-progress-copy.json' });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  async function signOut() {
    clearTimeout(timer);
    if (active() && !(await save(false))) throw new Error('local_changed');
    await api('/v1/auth/logout', 'POST', {});
    if (active()) {
      if ((await fingerprint(capture(state.binding.profileId, true))) !== state.binding.lastHash) {
        state.ready = false; throw new Error('local_changed');
      }
      await lock(function () {
        var reg = VP.readReg(), id = state.binding.profileId;
        if (!reg || reg === 'invalid' || reg.activeProfileId !== id) throw new Error('profile_changed');
        var previous = reg.profiles.find(function (p) { return p.id === state.binding.previousProfileId; }) || reg.profiles.find(function (p) { return p.id !== id; });
        if (!previous) throw new Error('local_storage');
        reg.profiles = reg.profiles.filter(function (p) { return p.id !== id; }); reg.activeProfileId = previous.id;
        reg.revision = (reg.revision || 0) + 1; reg.lastTransactionId = uuid();
        reg.pendingDeleteProfileIds = (reg.pendingDeleteProfileIds || []).concat(id);
        VP.rawSet(VP.REG, JSON.stringify(reg));
        var all = bindings(); delete all[bindingKey(state.target.id)]; localStorage.setItem(META, JSON.stringify(all));
      });
      sessionStorage.removeItem(SESSION); location.reload(); return;
    }
    state.session = null; state.target = null; state.binding = null; state.ready = false; state.remote = null;
    persistSession(); setStatus(t('Signed out. Local learner profiles are still available.', '已退出。仍可使用本地学习者资料。')); render();
  }
  async function localSignOut() {
    if (!(await confirmAction(t('Sign out of this tab without waiting for cloud sync? This account’s device copy will be kept separately, outside the local learner list. Sign in to the same account later to recover it. Clearing browser data will erase unsynced work.', '不等待云端同步，直接退出此标签页？此账户的本机副本将单独保留，不显示在本地学习者列表中。之后登录同一账户即可恢复。清除浏览器数据会删除尚未同步的成果。'), t('Sign out locally', '在本机退出')))) return;
    clearTimeout(timer); state.leaving = true;
    try {
      /* Let an already-started request settle before detaching its binding.
         This never starts or waits for a new network request. */
      if (savePromise) { try { await savePromise; } catch (_) {} }
      clearTimeout(timer);
      if (active()) {
        await lock(function () {
          var reg = VP.readReg(), id = state.binding.profileId, all = bindings();
          if (!reg || reg === 'invalid' || reg.activeProfileId !== id) throw new Error('profile_changed');
          var cloudIds = Object.values(all).filter(Boolean).map(function (b) { return b.profileId; });
          var previous = reg.profiles.find(function (p) { return p.id === state.binding.previousProfileId && cloudIds.indexOf(p.id) < 0; }) ||
            reg.profiles.find(function (p) { return p.id !== id && cloudIds.indexOf(p.id) < 0; });
          if (!previous) {
            var now = new Date().toISOString();
            previous = { id: uuid(), displayName: t('Local learner', '本地学习者'), createdAt: now, updatedAt: now };
            reg.profiles.push(previous);
          }
          var profile = reg.profiles.find(function (p) { return p.id === id; }), originalMeta = localStorage.getItem(META);
          /* A parked copy is intentionally absent from the normal profile
             registry. Its namespace is retained, never marked for deletion. */
          state.binding.profile = profile; state.binding.parked = true; state.binding.pending = true;
          persistBinding();
          reg.profiles = reg.profiles.filter(function (p) { return p.id !== id; });
          reg.activeProfileId = previous.id; reg.revision = (reg.revision || 0) + 1; reg.lastTransactionId = uuid();
          reg.pendingDeleteProfileIds = (reg.pendingDeleteProfileIds || []).filter(function (pendingId) { return pendingId !== id; });
          try { VP.rawSet(VP.REG, JSON.stringify(reg)); }
          catch (e) { if (originalMeta === null) localStorage.removeItem(META); else localStorage.setItem(META, originalMeta); throw new Error('local_storage'); }
        });
        sessionStorage.removeItem(SESSION); state.session = null; state.ready = false; state.pending = false;
        location.reload(); return;
      }
      state.session = null; state.target = null; state.binding = null; state.ready = false; state.remote = null; state.secrets = null;
      persistSession(); setStatus(t('Signed out of this tab. Any unsynced account copy is kept separately on this device. Sign in to the same account to recover it.', '已退出此标签页。尚未同步的账户副本已单独保存在本机。请登录同一账户恢复。')); render();
    } catch (e) {
      /* Even a full/blocked browser store must not retain the bearer token. */
      state.session = null; state.ready = false; state.secrets = null;
      persistSession(); render(); throw e;
    } finally { state.leaving = false; }
  }
  async function resumeDeviceCopy() {
    if (!state.ready || !state.session || !state.remote) throw new Error('sign_in_required');
    await lock(function () {
      var reg = VP.readReg(), binding = state.binding;
      if (!reg || reg === 'invalid' || !binding) throw new Error('local_storage');
      var profile = reg.profiles.find(function (p) { return p.id === binding.profileId; });
      if (!profile) {
        if (!binding.parked || !binding.profile || binding.profile.id !== binding.profileId) throw new Error('local_storage');
        profile = { id: binding.profileId, displayName: state.target.displayName || state.target.username,
          createdAt: binding.profile.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
        reg.profiles.push(profile);
      }
      var originalMeta = localStorage.getItem(META);
      binding.previousProfileId = reg.activeProfileId; binding.parked = false; persistBinding();
      reg.activeProfileId = binding.profileId; reg.revision = (reg.revision || 0) + 1; reg.lastTransactionId = uuid();
      try { VP.rawSet(VP.REG, JSON.stringify(reg)); }
      catch (e) { if (originalMeta === null) localStorage.removeItem(META); else localStorage.setItem(META, originalMeta); throw new Error('local_storage'); }
    });
    location.reload();
  }
  function field(form, name, label, type, hint) {
    var group = el('div', null, { class: 'lac-field' }), id = 'lac-' + name;
    var input = el('input', null, { id: id, name: name, type: type || 'text', required: '', autocomplete: name === 'username' ? 'username' : (type === 'password' ? 'current-password' : 'off') });
    if (name === 'username') { input.minLength = 3; input.maxLength = 32; input.pattern = '[a-zA-Z0-9][a-zA-Z0-9._-]{2,31}'; input.autocapitalize = 'none'; input.spellcheck = false; }
    if (name === 'displayName') input.maxLength = 60;
    group.append(el('label', label, { for: id }), input);
    if (hint) { input.setAttribute('aria-describedby', id + '-hint'); group.append(el('p', hint, { id: id + '-hint', class: 'lac-hint' })); }
    form.append(group); return input;
  }
  function formButton(form, text) { var b = el('button', text, { type: 'submit', class: 'btn btn-green' }); form.append(b); }
  function renderAuth() {
    if (active()) {
      panel.append(el('p', t('This account’s study copy is still open on this device. Reconnect to continue syncing, or sign out locally before signing in again.', '此账户的学习副本仍在本机打开。请恢复连接以继续同步，或先在本机退出，再重新登录。')));
      if (state.session) panel.append(button(t('Reconnect account', '重新连接账户'), function () { withBusy(async function () { await refreshIdentity(); await inspectRemote(); render(); refreshCopy(); }); }));
      return;
    }
    var tabs = el('div', null, { class: 'lac-actions', 'aria-label': t('Account actions', '账户操作') });
    [['login', t('Sign in', '登录')], ['register', t('Set up parent account', '创建家长账户')], ['recover', t('Recover parent account', '恢复家长账户')]].forEach(function (item) {
      var b = button(item[1], function () { state.mode = item[0]; setStatus(''); render(); });
      b.setAttribute('aria-pressed', String(state.mode === item[0])); tabs.append(b);
    });
    panel.append(tabs);
    var form = el('form', null, { class: 'lac-form' });
    var username = field(form, 'username', t('Username', '用户名'), 'text', t('3–32 letters, numbers, dots, underscores or hyphens. No email needed.', '3–32 个英文字母、数字、点、下划线或连字符。无需邮箱。'));
    var code = field(form, 'code', state.mode === 'register' ? t('Owner setup code', '所有者设置码') : state.mode === 'recover' ? t('Parent recovery code', '家长恢复码') : t('Sign-in code', '登录码'), 'password');
    formButton(form, state.mode === 'register' ? t('Create parent account', '创建家长账户') : state.mode === 'recover' ? t('Recover account', '恢复账户') : t('Sign in', '登录'));
    form.addEventListener('submit', function (event) {
      event.preventDefault(); withBusy(async function () {
        var mode = state.mode, payload = { username: username.value.trim() };
        payload[mode === 'register' ? 'setupCode' : mode === 'recover' ? 'recoveryCode' : 'code'] = code.value;
        var value = await api(mode === 'register' ? '/v1/parent/register' : mode === 'recover' ? '/v1/auth/recover' : '/v1/auth/login', 'POST', payload, true);
        code.value = ''; await acceptAuth(value);
      });
    });
    panel.append(form);
    panel.append(el('p', t('A parent creates learner usernames and keeps their generated codes. This browser still keeps a local copy while you study; sign out after using a shared device.', '家长创建学习者用户名并保管生成的登录码。学习时浏览器仍保留本地副本；使用共用设备后请退出。'), { class: 'lac-hint' }));
  }
  function renderSecrets() {
    var box = el('div', null, { class: 'lac-secrets', role: 'region', 'aria-label': t('Save your sign-in codes', '请保存登录码') });
    box.append(el('h4', t('Save these codes now', '请立即保存这些代码')));
    box.append(el('p', t('They are shown only once. Keep them somewhere private. A parent recovery resets all parent sessions.', '这些代码仅显示一次，请妥善保管。恢复家长账户会结束该账户的所有登录会话。')));
    box.append(el('p', t('Username: ', '用户名：') + state.secrets.username));
    box.append(el('label', t('Sign-in code', '登录码')));
    box.append(el('code', state.secrets.signInCode, { class: 'lac-code', tabindex: '0' }));
    if (state.secrets.recoveryCode) { box.append(el('label', t('Recovery code — parent only', '恢复码——仅供家长使用'))); box.append(el('code', state.secrets.recoveryCode, { class: 'lac-code', tabindex: '0' })); }
    box.append(button(t('I saved the codes', '我已保存代码'), function () { state.secrets = null; render(); }, true)); panel.append(box);
  }
  function renderParent() {
    panel.append(el('h4', t('Manage learner accounts', '管理学习者账户')));
    var form = el('form', null, { class: 'lac-form lac-create' });
    var username = field(form, 'username', t('New learner username', '新学习者用户名'));
    var name = field(form, 'displayName', t('Nickname', '昵称'));
    formButton(form, t('Create learner account', '创建学习者账户'));
    form.addEventListener('submit', function (event) { event.preventDefault(); withBusy(async function () {
      var value = await api('/v1/learners', 'POST', { username: username.value.trim(), displayName: name.value.trim() });
      state.secrets = { username: value.learner.username, signInCode: value.signInCode };
      state.learners = (await api('/v1/learners')).learners || []; render();
    }); }); panel.append(form);
    var list = el('ul', null, { class: 'lac-learners' });
    state.learners.forEach(function (learner) {
      var row = el('li'), title = el('div', null, { class: 'lac-learner-name' });
      title.append(el('strong', learner.displayName), el('span', learner.username + (learner.disabled ? t(' · Disabled', ' · 已停用') : ''))); row.append(title);
      var actions = el('div', null, { class: 'lac-actions' });
      var study = button(t('Open progress', '打开进度'), function () { withBusy(async function () {
        if (active() && state.target.id !== learner.id) { setStatus(t('Sign out of the current study profile before opening another learner.', '请先退出当前学习资料，再打开其他学习者。'), 'error'); return; }
        state.target = learner; state.binding = bindings()[bindingKey(learner.id)] || null; state.remote = null; state.conflict = false;
        persistSession(); await inspectRemote();
      }); }); study.disabled = learner.disabled; actions.append(study);
      actions.append(button(t('Reset sign-in code', '重置登录码'), async function () {
        if (!(await confirmAction(t('Reset this learner’s code? Their existing sessions will end. The new code will be shown once for you to save.', '重置此学习者的登录码？其现有登录会话将结束。新代码仅显示一次，请及时保存。'), t('Reset sign-in code', '重置登录码')))) return;
        withBusy(async function () { var v = await api('/v1/learners/' + encodeURIComponent(learner.id) + '/reset-code', 'POST', {}); state.secrets = { username: learner.username, signInCode: v.signInCode }; render(); });
      }));
      actions.append(button(t('Rename', '重命名'), function () {
        if (row.querySelector('.lac-rename')) return;
        var edit = el('form', null, { class: 'lac-form lac-rename' }), id = 'lac-rename-' + learner.id;
        var input = el('input', null, { id: id, type: 'text', required: '', maxlength: '60', autocomplete: 'off' }); input.value = learner.displayName;
        var group = el('div', null, { class: 'lac-field' }); group.append(el('label', t('New nickname', '新昵称'), { for: id }), input); edit.append(group);
        formButton(edit, t('Save nickname', '保存昵称'));
        edit.append(button(t('Cancel', '取消'), function () { edit.remove(); }));
        edit.addEventListener('submit', function (event) { event.preventDefault(); withBusy(async function () {
          var value = await api('/v1/learners/' + encodeURIComponent(learner.id), 'PATCH', { displayName: input.value.trim() });
          if (state.target && state.target.id === learner.id) { state.target = value.learner; persistSession(); }
          state.learners = (await api('/v1/learners')).learners || []; render();
        }); }); row.append(edit); input.focus();
      }));
      actions.append(button(learner.disabled ? t('Enable account', '启用账户') : t('Disable account', '停用账户'), async function () {
        if (!learner.disabled && !(await confirmAction(t('Disable sign-in for this learner? Their existing sessions will end. Saved progress is kept, and a parent can enable the account again.', '停用此学习者的登录？其现有登录会话将结束。已保存的进度会保留，家长之后可重新启用账户。'), t('Disable account', '停用账户')))) return;
        withBusy(async function () { await api('/v1/learners/' + encodeURIComponent(learner.id), 'PATCH', { disabled: !learner.disabled }); state.learners = (await api('/v1/learners')).learners || []; render(); });
      })); row.append(actions); list.append(row);
    }); panel.append(list);
  }
  function renderProgress() {
    if (!state.target) return;
    var box = el('div', null, { class: 'lac-progress' });
    box.append(el('h4', t('Progress for ', '学习进度：') + (state.target.displayName || state.target.username)));
    if (!state.remote) {
      box.append(button(t('Check cloud save', '查看云端存档'), function () { withBusy(inspectRemote); }, true)); panel.append(box); return;
    }
    if (!active()) {
      box.append(el('p', t('This opens a separate study profile. Existing local learners stay unchanged.', '这将打开独立的学习资料。现有本地学习者资料保持不变。')));
      var canImport = state.remote.revision === 0 && !Object.keys(state.remote.data).length;
      if (canImport) {
        var label = el('label', null, { class: 'lac-check' }), checkbox = el('input', null, { type: 'checkbox' });
        checkbox.checked = state.importing; checkbox.addEventListener('change', function () { state.importing = checkbox.checked; });
        label.append(checkbox, el('span', t('Copy this device’s current learner progress into this empty account', '把本机当前学习者的进度复制到此空账户'))); box.append(label);
      }
      if (state.binding && state.binding.pending) {
        box.append(el('p', t('This device has an unsynced account copy. Resume it first to preserve those changes.', '本机有此账户尚未同步的副本。请先恢复该副本以保留更改。'), { class: 'lac-warning' }));
        box.append(button(t('Resume this device’s copy', '恢复本机副本'), function () { withBusy(resumeDeviceCopy); }, true));
      } else box.append(button(t('Open account progress', '打开账户进度'), function () { withBusy(function () { return activate(state.remote, canImport && state.importing); }); }, true));
    } else {
      box.append(el('p', t('Automatic sync is on. Only confirmed server saves are shown as saved. Offline changes stay on this device.', '已启用自动同步。只有服务器确认后才显示已保存。离线更改保留在本机。')));
      var actions = el('div', null, { class: 'lac-actions' });
      actions.append(button(t('Save now', '立即保存'), function () { withBusy(function () { return save(false); }); }, true));
      actions.append(button(t('Check for newer save', '检查更新存档'), function () { withBusy(inspectRemote); }));
      actions.append(button(t('Download this progress copy', '下载此进度副本'), downloadBackup)); box.append(actions);
      if (state.conflict || state.remote.revision !== state.binding.revision) {
        var conflict = el('div', null, { class: 'lac-conflict', role: 'region', 'aria-label': t('Choose a progress copy', '选择进度副本') });
        conflict.append(el('p', t('Cloud and device saves differ. Download a copy before replacing either version. These actions do not merge histories.', '云端与本机存档不同。替换任何版本前请先下载副本。以下操作不会合并记录。')));
        conflict.append(button(t('Load the cloud copy', '加载云端副本'), async function () {
          if (!(await confirmAction(t('Replace this account’s device copy with the cloud save? Device changes that have not synced will be replaced. Cancel and download this progress copy first if you need to keep it.', '用云端存档替换此账户的本机副本？尚未同步的本机更改将被替换。如需保留，请取消并先下载此进度副本。'), t('Load the cloud copy', '加载云端副本')))) return;
          withBusy(function () { return activate(state.remote, false); });
        }));
        conflict.append(button(t('Keep this device’s copy in cloud', '把本机副本保存到云端'), async function () {
          if (!(await confirmAction(t('Replace the cloud save with this device’s progress? Other devices will receive this copy. Histories are not merged.', '用本机进度替换云端存档？其他设备将收到此副本。记录不会合并。'), t('Replace the cloud save', '替换云端存档')))) return;
          withBusy(async function () { await save(true); render(); });
        })); box.append(conflict);
      }
    }
    panel.append(box);
  }
  function render() {
    if (!panel) return;
    panel.replaceChildren();
    panel.append(el('h3', t('Accounts & cloud progress', '账户与云端进度'), { id: 'lac-heading' }));
    panel.append(el('p', t('Sign in to keep a learner’s saved work available on another device. Parent-managed accounts do not require an email address.', '登录后可在其他设备继续使用已保存的学习成果。由家长管理的账户不需要邮箱。'), { class: 'lac-intro' }));
    var status = state.syncMessage ? syncPresentation() : { text: state.status, tone: state.tone };
    panel.append(el('p', status.text, { class: 'lac-status ' + status.tone, role: status.tone === 'error' ? 'alert' : 'status', 'aria-live': 'polite', 'aria-atomic': 'true' }));
    if (state.secrets) { renderSecrets(); updateChrome(); return; }
    if (!state.session || !state.ready) renderAuth();
    else {
      panel.append(el('p', t('Signed in as ', '当前登录：') + state.session.user.username + (state.session.user.role === 'parent' ? t(' · Parent', ' · 家长') : t(' · Learner', ' · 学习者')), { class: 'lac-identity' }));
      renderProgress(); if (state.session.user.role === 'parent') renderParent();
      panel.append(button(t('Save and sign out', '保存并退出'), function () { withBusy(signOut); }));
    }
    if (state.session || active()) {
      var exit = el('div', null, { class: 'lac-local-exit' });
      exit.append(button(t('Sign out locally · keep device copy', '本机退出 · 保留副本'), function () { withBusy(localSignOut); }));
      exit.append(el('p', t('Use this when offline or sync needs attention. It removes sign-in from this tab and keeps unsynced work separately for the same account. The server session may remain valid until it expires.', '离线或同步遇到问题时可使用。此操作会清除此标签页的登录信息，并单独保留该账户尚未同步的成果。服务器会话可能保持有效，直至到期。'), { class: 'lac-hint' })); panel.append(exit);
    }
    updateChrome();
  }
  function updateChrome() {
    var linked = active(); document.body.classList.toggle('lac-cloud-active', linked);
    if (linked) {
      var chip = document.getElementById('vaSaveChip');
      var text = syncPresentation().text;
      if (chip && chip.textContent !== text) chip.textContent = text;
    }
  }
  /* Update existing privacy/storage copy at its source when possible.
     Text-only replacement also covers strings built inside closed modules.
     Activity/lab notes about unsaved in-page tables are deliberately excluded. */
  var cloudNote = ['Your progress syncs automatically to your account. Check the save status before switching devices.', '进度会自动同步到账户。切换设备前请确认保存状态。'];
  var cloudReport = ['This report reflects this device’s current account copy. Sync before comparing it with another device.', '本报告反映此设备上的当前账户副本。与其他设备比较前请先同步。'];
  function accountCopy() {
    if (window.I18N && I18N.en && I18N.zh) {
      I18N.en.footP1 = 'Free learning for students, parents and teachers. No ads. Use local profiles or optional parent-managed accounts to sync progress across devices.';
      I18N.zh.footP1 = '面向学生、家长和教师的免费学习站，无广告。可使用本地资料，或选择家长管理的账户来跨设备同步进度。';
      ['en', 'zh'].forEach(function (lang) {
        var value = I18N[lang].heroLede;
        if (typeof value === 'string') I18N[lang].heroLede = value.replace('No sign-up.', 'No sign-up required; accounts are optional.').replace('无需注册。', '无需注册也能学习；账户为可选功能。');
      });
    }
    if (active()) {
      [window.SRS_STR, window.MIST_STR, window.REP_STR].forEach(function (dict) {
        if (dict && dict.en && dict.zh) { dict.en.savedNote = cloudNote[0]; dict.zh.savedNote = cloudNote[1]; }
      });
      if (window.DP_STR) DP_STR.savedNote = cloudNote.slice();
      if (window.REP_STR) {
        REP_STR.en.sub = cloudReport[0]; REP_STR.zh.sub = cloudReport[1];
        REP_STR.en.foot = cloudReport[0] + ' Printing creates a report from the work currently shown here.';
        REP_STR.zh.foot = cloudReport[1] + '打印会根据此处当前显示的学习记录生成报告。';
      }
    }
  }
  function replaceAccountText(root) {
    if (!root || !active()) return;
    var replacements = [
      ['No sign-up and nothing to install. Do these three steps once, and the fieldbook starts keeping your record on this device.', 'Nothing to install. Follow these three steps to start learning. Check the save status to confirm your progress has synced.'],
      ['无需注册，也不用安装。完成这三步，笔记本就会开始在这台设备上记录你的学习。', '不用安装。完成这三步即可开始学习。请查看保存状态，确认进度已同步。'],
      ['When the check holds, mark the lesson done — your record is saved on this device.', 'When the check holds, mark the lesson done — your progress will sync to your account. Check the save status before switching devices.'],
      ['测验通过后标记完成——记录保存在这台设备上。', '测验通过后标记完成——进度会同步到账户。切换设备前请确认保存状态。'],
      ['Saved only on this device — nothing is uploaded.', cloudNote[0]],
      ['Saved on this device — there is no account and nothing syncs. Clearing browser or site data, switching browser profiles, or losing this device can remove your progress, so export a backup below from time to time.', 'Your progress syncs automatically to your account. Wait for “Saved to your account” before switching devices. You can also export an extra backup below. Keep offline changes in this browser until syncing finishes.'],
      ['保存在这台设备上——没有账号，也没有任何同步。清除浏览器或网站数据、更换浏览器配置文件，或丢失这台设备，都可能删除你的进度，所以请时常在下方导出一份备份。', '进度会自动同步到账户。看到“已保存到你的账户”后再切换设备。也可以在下方导出额外备份。离线更改在同步完成前需要保留在此浏览器中。'],
      ['只保存在这台设备上——不会上传到任何地方。', cloudNote[1]],
      ['Computed on this device — nothing is uploaded.', cloudReport[0]],
      ['在这台设备上计算——不会上传任何内容。', cloudReport[1]],
      ['Based on learning activity saved on this device.', cloudReport[0]],
      ['根据保存在此设备上的学习活动生成。', cloudReport[1]],
      ['Your answers are saved on this device only.', cloudNote[0]],
      ['你的答案只保存在这台设备上。', cloudNote[1]],
      ['Exam data is stored only in this browser on this device. Clearing browser data may erase it.', 'Exam progress syncs to your account. Wait for save confirmation before switching devices. Keep offline work in this browser until syncing finishes.'],
      ['模拟考试数据仅保存在此设备的当前浏览器中。清除浏览器数据可能会将其删除。', '模拟考试进度会同步到账户。切换设备前请确认已保存。离线成果在同步完成前需要保留在此浏览器中。'],
      ['Learners are stored only in this browser. They are not accounts or password-protected.', 'You are studying in an account-linked profile. Local browser copies are not password-protected; sign out when using a shared device.'],
      ['学习者资料仅保存在当前浏览器中，不是账户，也没有密码保护。', '当前使用与账户关联的学习资料。本地浏览器副本不受密码保护；使用共用设备后请退出。'],
      ['This report reflects learning saved on THIS device and browser only — nothing is uploaded, and progress on another device will look different.', cloudReport[0]],
      ['本报告只反映保存在这台设备和这个浏览器上的学习记录——不会上传任何数据，其他设备上的进度会不一样。', cloudReport[1]],
      ['Device-only data. Printing uses your browser\'s Print command — the report is laid out to fit one page.', 'Printing uses this device’s current account copy. Sync before comparing reports from other devices.'],
      ['数据仅来自本设备。打印请用浏览器的打印命令——报告已排成一页。', '打印使用此设备上的当前账户副本。与其他设备的报告比较前请先同步。'],
      ['Nothing here leaves the device.', 'Saved account progress syncs across devices.'],
      ['No accounts, nothing uploaded.', 'Saved account progress syncs across devices.'],
      ['没有账号，什么都不会上传。', '已保存的账户进度会跨设备同步。'],
      ['Nothing is uploaded anywhere.', 'While studying in an account profile, saved progress is synced to the account.'],
      ['任何内容都不会上传。', '使用账户学习资料时，已保存的进度会同步到账户。']
    ];
    function replace(node) {
      if (!node.parentElement || node.parentElement.closest('script,style,textarea,input,code,.lac-panel,#vaSaveChip')) return;
      var text = node.nodeValue, next = text;
      replacements.forEach(function (pair) { next = next.split(pair[0]).join(pair[1]); });
      /* Legacy result/save badges acknowledge local writes, not cloud writes.
         Point to the dynamic status instead of promising an unconfirmed backup. */
      if (next.trim() === 'Saved on this device') next = 'Check account save status';
      else if (next.trim() === '已保存在此设备上' || next.trim() === '已保存在此设备') next = '请查看账户保存状态';
      else if (/^Saved on this device for .+\.$/.test(next.trim())) next = next.trim().replace(/^Saved on this device for (.+)\.$/, 'Account progress for $1. Check the save status.');
      else if (/^已为学习者.+保存在此设备上。$/.test(next.trim())) next = next.trim().replace(/^已为学习者(.+)保存在此设备上。$/, '学习者$1的账户进度。请查看保存状态。');
      if (next !== text) node.nodeValue = next;
    }
    if (root.nodeType === 3) { replace(root); return; }
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), node;
    while ((node = walker.nextNode())) replace(node);
  }
  function refreshCopy() {
    accountCopy();
    if (window.I18N) {
      [['footP1', I18N.en.footP1, I18N.zh.footP1], ['heroLede', I18N.en.heroLede, I18N.zh.heroLede]].forEach(function (item) {
        var n = document.querySelector('[data-i18n="' + item[0] + '"]'); if (n) n.textContent = t(item[1], item[2]);
      });
    }
    replaceAccountText(document.body);
  }
  function placeAccountPanel() {
    var heading = document.getElementById('pfH'), header = heading && heading.closest('.sec-head');
    if (header && header.parentElement === home) header.after(panel);
    else home.append(panel);
  }
  function openAccounts() {
    if (document.getElementById('pfGate')) {
      if (!dialog) {
        dialog = el('dialog', null, { class: 'lac-dialog', 'aria-labelledby': 'lac-heading' });
        dialog.append(button(t('Close', '关闭'), function () { dialog.close(); })); document.body.append(dialog);
        dialog.addEventListener('close', placeAccountPanel);
      }
      dialog.append(panel); dialog.showModal();
    } else { location.hash = '#learners'; setTimeout(function () { panel.scrollIntoView({ block: 'start' }); panel.querySelector('h3').setAttribute('tabindex', '-1'); panel.querySelector('h3').focus({ preventScroll: true }); }, 120); }
  }
  function observeWrites() {
    if (watching) return; watching = true;
    ['setItem', 'removeItem'].forEach(function (method) {
      var original = Storage.prototype[method];
      Storage.prototype[method] = function (key) {
        var result = original.apply(this, arguments);
        if (this === localStorage && active() && isProgressKey(String(key), state.binding.profileId)) {
          state.pending = true; state.binding.pending = true;
          try { persistBinding(); } catch (_) { setStatus(message(new Error('local_storage')), 'error'); }
          showSyncStatus(); queueSave();
        }
        return result;
      };
    });
    window.addEventListener('online', function () { if (active()) showSyncStatus(); if (state.pending) queueSave(); });
    window.addEventListener('offline', function () { if (active()) showSyncStatus(); });
    window.addEventListener('beforeunload', function (event) { if (!state.leaving && active() && state.pending) { event.preventDefault(); event.returnValue = ''; } });
    document.addEventListener('click', function (event) {
      var b = event.target.closest && event.target.closest('#pfSwitch');
      if (b && active()) { event.preventDefault(); event.stopImmediatePropagation(); openAccounts(); }
    }, true);
    ['langEn', 'langZh', 'langBi'].forEach(function (id) { var b = document.getElementById(id); if (b) b.addEventListener('click', function () { setTimeout(function () { render(); refreshCopy(); }, 220); }); });
    new MutationObserver(function (records) {
      records.forEach(function (record) {
        if (record.type === 'characterData') replaceAccountText(record.target);
        else record.addedNodes.forEach(replaceAccountText);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  async function init() {
    VP = window.VAProfiles; home = document.getElementById('learners');
    if (!VP || !home) return;
    panel = el('div', null, { class: 'lac-panel', id: 'learningCloudAccounts' }); placeAccountPanel();
    bindActiveDeviceCopy(); render(); observeWrites(); refreshCopy();
    var gate = document.querySelector('#pfGate .pf-actions');
    if (gate && VP.boot.mode !== 'recovery') gate.append(button(t('Sign in to cloud account', '登录云端账户'), openAccounts));
    var stored = readJSON(sessionStorage, SESSION, null);
    if (stored && stored.endpoint === endpoint && typeof stored.token === 'string' && Date.parse(stored.expiresAt) > Date.now()) {
      state.session = stored; state.target = stored.target || null;
      bindActiveDeviceCopy(); render();
      await withBusy(async function () { await refreshIdentity(); render(); refreshCopy(); if (state.target) await inspectRemote(); });
    } else if (stored) { sessionStorage.removeItem(SESSION); setStatus(t('Sign in again to sync. Any unsaved device copy is preserved.', '请重新登录以同步。尚未同步的本机副本已保留。')); }
  }
  if (document.readyState === 'complete') init(); else window.addEventListener('load', init, { once: true });
})();
