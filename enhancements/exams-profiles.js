/* =====================================================================
   SOL Practice Exams + Device-Local Learner Profiles
   - Exams: subject- and grade/course-based (one subject at a time). Each run
     samples only its profile's approved lessons from the real
     511-question lesson bank: Q = min(45, pool) questions at
     2 minutes per question, review-before-submit, results stored ONLY
     in vaSolExam.v1 (inside the active learner's namespace) and never
     fed into mastery, FSRS, mistakes, or lesson completion. Pre-
     restructure cross-subject exam records are dropped on load (they
     were practice estimates only, never learning data; see the storage
     note in the exam section below).
   - Score estimate is an honestly-labeled linear rescaling of practice
     accuracy (correct/total x 600) — not an official SOL score, no pass
     prediction.
   - Profiles: registry vaProfiles.v1; the head boot shim hydrates the
     active profile and mirrors every logical va* write into its
     namespace, so switching is a registry write + reload, lossless by
     construction.
   ===================================================================== */
(function () {
  "use strict";
  var VP = window.VAProfiles;
  if (!VP) return;
  var LS = VP.LS;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function langIdx() { try { return LS.getItem("vaLang.v1") === "zh" ? 1 : 0; } catch (e) { return 0; } }
  function T(en, zh) { return langIdx() ? zh : en; }
  function F(en, zh, map) { var s = T(en, zh); for (var k in (map || {})) s = s.split("{" + k + "}").join(map[k]); return s; }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16); crypto.getRandomValues(b);
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  }
  function nowIso() { return new Date().toISOString(); }
  function sha256hex(str) {
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
      return crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
      }).catch(function () { return fnv(str); });
    }
    return Promise.resolve(fnv(str));
  }
  function fnv(str) { var h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (var i = 0; i < str.length; i++) { var ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return ("0000000" + (h2 >>> 0).toString(16)).slice(-8) + ("0000000" + (h1 >>> 0).toString(16)).slice(-8); }
  function fmtBytes(n) { if (n < 1024) return n + " B"; if (n < 1048576) return (n / 1024).toFixed(1) + " KB"; return (n / 1048576).toFixed(2) + " MB"; }
  function fmtDate(iso) { try { return new Intl.DateTimeFormat(langIdx() ? "zh-CN" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)); } catch (e) { return iso; } }
  function download(name, text) {
    var blob = new Blob([text], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a"); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function withLock(name, fn) {
    if (navigator.locks && navigator.locks.request) return navigator.locks.request(name, fn);
    return Promise.resolve().then(fn);
  }

  /* ============================ PROFILES ============================ */
  var REG = VP.REG, JRN = "vaProfileMigration.v1", OPN = "vaProfileOperation.v1";
  function writeReg(reg) { VP.rawSet(REG, JSON.stringify(reg)); }
  function profilePrefix(id) { return "vaP_" + id + "__"; }
  function namespaceEntries(id) {
    var pfx = profilePrefix(id), out = {};
    VP.allKeys().forEach(function (k) { if (k.indexOf(pfx) === 0) { var v = VP.rawGet(k); if (v !== null) out[k.slice(pfx.length)] = v; } });
    return out;
  }
  function clearNamespace(id) {
    var pfx = profilePrefix(id);
    VP.allKeys().forEach(function (k) { if (k.indexOf(pfx) === 0) VP.rawRem(k); });
  }
  function usageByProfile(reg) {
    var total = 0, per = {}, infra = 0;
    VP.allKeys().forEach(function (k) {
      var v = VP.rawGet(k) || ""; var n = 2 * (k.length + v.length); total += n;
      var m = /^vaP_([0-9a-f-]{36})__/.exec(k);
      if (m) per[m[1]] = (per[m[1]] || 0) + n; else if (VP.isInfra(k) || k === REG) infra += n;
    });
    return { total: total, per: per, infra: infra };
  }

  /* --- crash recovery: pending deletes + staged operations --- */
  function recoverProfiles() {
    var reg = VP.readReg();
    if (!reg || reg === "invalid") return;
    var changed = false;
    if (Array.isArray(reg.pendingDeleteProfileIds) && reg.pendingDeleteProfileIds.length) {
      reg.pendingDeleteProfileIds.forEach(function (id) { clearNamespace(id); });
      reg.pendingDeleteProfileIds = []; changed = true;
    }
    var opn = null;
    try { var r = VP.rawGet(OPN); if (r) opn = JSON.parse(r); } catch (e) { opn = null; }
    if (opn && opn.operationId) {
      if (reg.lastTransactionId === opn.operationId) { VP.rawRem(OPN); }
      else {
        (opn.stagedProfiles || []).forEach(function (sp) { if (sp && sp.profile && sp.profile.id) clearNamespace(sp.profile.id); });
        VP.rawRem(OPN);
      }
    }
    if (changed) { reg.revision = (reg.revision || 1) + 1; reg.lastTransactionId = uuid(); writeReg(reg); }
  }

  /* --- migration of pre-profile data --- */
  function doMigration(name) {
    return withLock("va-learning-storage.v1", function () {
      var logical = VP.allKeys().filter(VP.isLogical).sort();
      var snapshot = {};
      logical.forEach(function (k) { snapshot[k] = VP.rawGet(k); });
      var id = uuid(), mid = uuid(), ts = nowIso();
      var profile = { id: id, displayName: name, createdAt: ts, updatedAt: ts };
      return Promise.all(logical.map(function (k) {
        return sha256hex(snapshot[k]).then(function (h) { return { logicalKey: k, sourceLength: snapshot[k].length, sourceSha256: h }; });
      })).then(function (entries) {
        VP.rawSet(JRN, JSON.stringify({ schemaVersion: 1, migrationId: mid, targetProfile: profile, startedAt: ts, phase: "copying", entries: entries }));
        var pfx = profilePrefix(id);
        logical.forEach(function (k) { VP.rawSet(pfx + k, snapshot[k]); });
        logical.forEach(function (k) { if (VP.rawGet(pfx + k) !== snapshot[k]) throw new Error("verify"); });
        var j = JSON.parse(VP.rawGet(JRN)); j.phase = "verified"; VP.rawSet(JRN, JSON.stringify(j));
        writeReg({ schemaVersion: 1, revision: 1, lastTransactionId: mid, activeProfileId: id, profiles: [profile], pendingDeleteProfileIds: [] });
        var back = VP.readReg(); if (!back || back === "invalid" || back.activeProfileId !== id) throw new Error("commit");
        VP.rawRem(JRN);
      });
    });
  }

  /* --- staged add / import --- */
  function stageProfiles(newProfiles, rawById, activateId, kind, baseRevision) {
    return withLock("va-learning-storage.v1", function () {
      var opId = uuid(), ts = nowIso();
      return Promise.all(newProfiles.map(function (p) {
        var raw = rawById[p.id] || {};
        var keys = Object.keys(raw).sort();
        return Promise.all(keys.map(function (k) {
          return sha256hex(raw[k]).then(function (h) { return { logicalKey: k, sourceLength: raw[k].length, sourceSha256: h }; });
        })).then(function (entries) { return { profile: p, entries: entries }; });
      })).then(function (staged) {
        VP.rawSet(OPN, JSON.stringify({ schemaVersion: 1, operationId: opId, kind: kind, startedAt: ts, baseRevision: baseRevision, activateProfileId: activateId, phase: "staging", stagedProfiles: staged }));
        newProfiles.forEach(function (p) {
          var raw = rawById[p.id] || {}, pfx = profilePrefix(p.id);
          Object.keys(raw).forEach(function (k) { VP.rawSet(pfx + k, raw[k]); });
          Object.keys(raw).forEach(function (k) { if (VP.rawGet(pfx + k) !== raw[k]) throw new Error("verify"); });
        });
        var j = JSON.parse(VP.rawGet(OPN)); j.phase = "verified"; VP.rawSet(OPN, JSON.stringify(j));
        var reg = VP.readReg();
        if (reg && reg !== "invalid") {
          reg.profiles = reg.profiles.concat(newProfiles);
          if (activateId) reg.activeProfileId = activateId;
          reg.revision = (reg.revision || 1) + 1; reg.lastTransactionId = opId;
          writeReg(reg);
        } else {
          writeReg({ schemaVersion: 1, revision: 1, lastTransactionId: opId, activeProfileId: activateId || newProfiles[0].id, profiles: newProfiles.slice(), pendingDeleteProfileIds: [] });
        }
        VP.rawRem(OPN);
      });
    });
  }

  function exportAllProfiles() {
    var reg = VP.readReg(); if (!reg || reg === "invalid") return;
    var profiles = reg.profiles.map(function (p) {
      var storage = namespaceEntries(p.id);
      if (p.id === reg.activeProfileId) { /* active namespace is mirror-synced on every write */ }
      return { p: p, storage: storage };
    });
    Promise.all(profiles.map(function (item) {
      var sums = {};
      return Promise.all(Object.keys(item.storage).map(function (k) {
        return sha256hex(item.storage[k]).then(function (h) { sums[k] = h; });
      })).then(function () {
        return { sourceProfileId: item.p.id, displayName: item.p.displayName, createdAt: item.p.createdAt, updatedAt: item.p.updatedAt, storage: item.storage, storageSha256: sums };
      });
    })).then(function (out) {
      var backup = { format: "va-learning-all-profiles", schemaVersion: 1, exportedAt: nowIso(), appVersion: "va-learning-ladder", activeSourceProfileId: reg.activeProfileId, profiles: out };
      var stamp = nowIso().replace(/[:.]/g, "-").replace(/-\d+Z$/, "Z");
      download("va-learning-all-profiles_" + stamp + ".json", JSON.stringify(backup, null, 2));
    });
  }
  function exportRecovery() {
    var entries = [];
    VP.allKeys().forEach(function (k) { if (k.indexOf("va") === 0) { var v = VP.rawGet(k); if (v !== null) entries.push({ physicalKey: k, rawValue: v }); } });
    if (!entries.length) return false;
    download("va-learning-storage-recovery_" + nowIso().replace(/[:.]/g, "-").replace(/-\d+Z$/, "Z") + ".json",
      JSON.stringify({ format: "va-learning-storage-recovery", schemaVersion: 1, exportedAt: nowIso(), entries: entries }, null, 2));
    return true;
  }

  function importBackupFile(file, done) {
    if (file.size > 32 * 1024 * 1024) { done(T("This file exceeds the 32 MiB import limit. Nothing was changed.", "此文件超过 32 MiB 的导入上限，未更改任何数据。")); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(String(reader.result)); } catch (e) { done(T("This backup is invalid or unsupported. Nothing was changed.", "此备份无效或不受支持，未更改任何数据。")); return; }
      if (!data || data.format !== "va-learning-all-profiles" || data.schemaVersion !== 1 || !Array.isArray(data.profiles) || !data.profiles.length) {
        done(T("This backup is invalid or unsupported. Nothing was changed.", "此备份无效或不受支持，未更改任何数据。")); return;
      }
      var checks = [];
      var ok = true;
      data.profiles.forEach(function (bp) {
        if (!bp || typeof bp.displayName !== "string" || !bp.storage || !bp.storageSha256) { ok = false; return; }
        var ks = Object.keys(bp.storage).sort(), ks2 = Object.keys(bp.storageSha256).sort();
        if (ks.join("|") !== ks2.join("|")) { ok = false; return; }
        ks.forEach(function (k) {
          if (!VP.isLogical(k) || typeof bp.storage[k] !== "string") { ok = false; return; }
          checks.push(sha256hex(bp.storage[k]).then(function (h) { if (h !== bp.storageSha256[k]) ok = false; }));
        });
      });
      Promise.all(checks).then(function () {
        if (!ok) { done(T("This backup is invalid or unsupported. Nothing was changed.", "此备份无效或不受支持，未更改任何数据。")); return; }
        var reg = VP.readReg();
        var fresh = !reg || reg === "invalid";
        var newProfiles = [], rawById = {}, activateId = null;
        data.profiles.forEach(function (bp) {
          var nid = uuid();
          var p = { id: nid, displayName: bp.displayName.slice(0, 40), createdAt: bp.createdAt || nowIso(), updatedAt: bp.updatedAt || bp.createdAt || nowIso() };
          newProfiles.push(p); rawById[nid] = bp.storage;
          if (fresh && bp.sourceProfileId === data.activeSourceProfileId) activateId = nid;
        });
        if (fresh && !activateId) activateId = newProfiles[0].id;
        var addBytes = 0;
        Object.keys(rawById).forEach(function (id) { Object.keys(rawById[id]).forEach(function (k) { addBytes += 2 * (k.length + rawById[id][k].length); }); });
        var preview = F("Import {count} learners using approximately {size} of storage. Existing learners will not be replaced.", "将导入 {count} 位学习者，预计占用 {size} 存储空间，不会替换现有学习者。", { count: newProfiles.length, size: fmtBytes(addBytes) });
        done(null, false, preview, function () {
          stageProfiles(newProfiles, rawById, fresh ? activateId : null, fresh ? "fresh-import" : "import", fresh ? null : (reg ? reg.revision : null))
            .then(function () { done(F("Imported {count} learners.", "已导入 {count} 位学习者。", { count: newProfiles.length }), true); })
            .catch(function () { done(T("This backup is invalid or unsupported. Nothing was changed.", "此备份无效或不受支持，未更改任何数据。")); });
        });
      });
    };
    reader.onerror = function () { done(T("This backup is invalid or unsupported. Nothing was changed.", "此备份无效或不受支持，未更改任何数据。")); };
    reader.readAsText(file);
  }

  /* ============================ PROFILE UI ============================ */
  function validName(raw) {
    var name = String(raw == null ? "" : raw).trim();
    var n = Array.from(name).length;
    if (n < 1 || n > 40 || /[\u0000-\u001f\u007f-\u009f]/.test(name)) return null;
    return name;
  }
  function activeProfile(reg) { for (var i = 0; i < reg.profiles.length; i++) if (reg.profiles[i].id === reg.activeProfileId) return reg.profiles[i]; return reg.profiles[0]; }

  function makeDialog(html) {
    var d = document.createElement("dialog");
    d.className = "va-dlg"; d.innerHTML = html;
    document.body.appendChild(d);
    d.addEventListener("close", function () { d.remove(); });
    return d;
  }
  function dlgButtons(d, cancelLabel) {
    var row = document.createElement("div"); row.className = "pf-actions";
    return row;
  }

  function renderSwitcher() {
    var btn = $("pfSwitch"); if (!btn) return;
    var reg = VP.readReg();
    if (!reg || reg === "invalid") { btn.textContent = T("Learner", "学习者"); btn.disabled = true; return; }
    var p = activeProfile(reg);
    btn.textContent = F("Learner: {name}", "学习者：{name}", { name: p.displayName });
    btn.setAttribute("aria-label", F("Learner: {name}. Switch learner", "学习者：{name}。切换学习者", { name: p.displayName }));
  }

  function openSwitcher() {
    var reg = VP.readReg(); if (!reg || reg === "invalid") return;
    closeSwitcher();
    var pop = document.createElement("div");
    pop.className = "pf-pop open"; pop.id = "pfPop";
    var rows = reg.profiles.map(function (p) {
      var cur = p.id === reg.activeProfileId;
      return '<div class="pf-row"><span class="nm">' + esc(p.displayName) + "</span>" +
        (cur ? '<span class="pf-cur">' + esc(T("Current learner", "当前学习者")) + "</span>"
             : '<button type="button" class="mini-btn" data-switch="' + p.id + '" style="min-height:44px">' + esc(T("Switch learner", "切换学习者")) + "</button>") + "</div>";
    }).join("");
    pop.innerHTML = '<div class="pf-card" role="dialog" aria-modal="true" aria-label="' + esc(T("Switch learner", "切换学习者")) + '"><h3>' +
      esc(T("Switch learner", "切换学习者")) + "</h3>" + rows +
      '<div class="pf-actions"><a class="btn btn-green" href="#learners" id="pfManageLink">' + esc(T("Manage learners", "管理学习者")) + '</a>' +
      '<button type="button" class="btn btn-line" id="pfPopClose">' + esc(T("Cancel", "取消")) + "</button></div>" +
      '<p class="pf-note">' + esc(T("Learners are stored only in this browser. They are not accounts or password-protected.", "学习者资料仅保存在当前浏览器中，不是账户，也没有密码保护。")) + "</p></div>";
    document.body.appendChild(pop);
    $("pfSwitch").setAttribute("aria-expanded", "true");
    pop.addEventListener("click", function (e) { if (e.target === pop) closeSwitcher(); });
    $("pfPopClose").addEventListener("click", closeSwitcher);
    $("pfManageLink").addEventListener("click", goToLearners);
    Array.prototype.forEach.call(pop.querySelectorAll("[data-switch]"), function (b) {
      b.addEventListener("click", function () { switchProfile(b.getAttribute("data-switch")); });
    });
    var first = pop.querySelector("[data-switch]") || $("pfPopClose"); if (first) first.focus();
  }
  function closeSwitcher() {
    var pop = $("pfPop"); if (pop) pop.remove();
    var btn = $("pfSwitch"); if (btn) { btn.setAttribute("aria-expanded", "false"); btn.focus(); }
  }
  /* "Manage learners" (and the menu's Learners link) must land on the
     #learners section as its own page view. The Manage link lives in
     this popover, which is appended to <body> — OUTSIDE the toolbar
     panel — so the menu's own "a panel link closes the menu" handler
     never fires for it: the anchor jump used to land on the section
     BEHIND the still-open full-screen menu overlay, and when the user
     then closed the menu by hand, the menu controller restored the
     scroll position saved when the menu opened, wiping the jump — the
     learners page looked gone. Close BOTH layers here, suppress the
     in-place anchor jump, and navigate only after the menu has closed,
     its saved-scroll restore has run, and the body scroll lock has been
     released, so the jump sticks and the section stays in view. */
  function goToLearners(e) {
    if (e && e.preventDefault) e.preventDefault();
    closeSwitcher();
    var bar = document.querySelector(".toolbar");
    if (bar && bar.classList.contains("open")) {
      bar.classList.remove("open");
      var tgl = $("navToggle"); if (tgl) tgl.setAttribute("aria-expanded", "false");
    }
    setTimeout(function () {
      var sec = $("learners"); if (!sec) return;
      try { if (window.location.hash !== "#learners") window.location.hash = "learners"; } catch (err) {}
      sec.scrollIntoView();
      var h = $("pfH");
      if (h) { if (!h.hasAttribute("tabindex")) h.setAttribute("tabindex", "-1"); try { h.focus({ preventScroll: true }); } catch (err) {} }
    }, 60);
  }
  function switchProfile(id) {
    var reg = VP.readReg(); if (!reg || reg === "invalid" || id === reg.activeProfileId) { closeSwitcher(); return; }
    if (!reg.profiles.some(function (p) { return p.id === id; })) return;
    reg.activeProfileId = id; reg.revision = (reg.revision || 1) + 1; reg.lastTransactionId = uuid();
    try { writeReg(reg); } catch (e) { return; }
    location.reload();
  }

  function renderManager(msg) {
    var host = $("pfHost"); if (!host) return;
    var reg = VP.readReg();
    $("pfSub").textContent = T("Learners are stored only in this browser. They are not accounts or password-protected.", "学习者资料仅保存在当前浏览器中，不是账户，也没有密码保护。");
    if (!reg || reg === "invalid") {
      host.innerHTML = '<p class="pf-note">' + esc(T("Stored profile information could not be read safely. Export a recovery backup before making changes.", "无法安全读取已保存的学习者资料。更改数据前，请先导出恢复备份。")) + "</p>" +
        '<div class="pf-actions"><button type="button" class="btn btn-line" id="pfRecoveryBtn">' + esc(T("Export recovery backup", "导出恢复备份")) + "</button></div>";
      var rb = $("pfRecoveryBtn"); if (rb) rb.addEventListener("click", function () { exportRecovery(); });
      return;
    }
    var u = usageByProfile(reg);
    var rows = reg.profiles.map(function (p) {
      var cur = p.id === reg.activeProfileId;
      return '<div class="pf-row"><div style="flex:1;min-width:0"><span class="nm">' + esc(p.displayName) + "</span>" +
        (cur ? ' <span class="pf-cur">' + esc(T("Current learner", "当前学习者")) + "</span>" : "") +
        '<div class="pf-meta">' + esc(F("Created {date} · ID {id}", "创建于 {date} · 编号 {id}", { date: fmtDate(p.createdAt), id: p.id.slice(0, 8) })) + " · " + esc(fmtBytes(u.per[p.id] || 0)) + "</div></div>" +
        '<button type="button" class="mini-btn" data-rename="' + p.id + '" style="min-height:44px">' + esc(T("Rename learner", "重命名学习者")) + "</button>" +
        '<button type="button" class="mini-btn" data-delete="' + p.id + '" style="min-height:44px"' + (reg.profiles.length <= 1 ? " disabled" : "") + ">" + esc(T("Delete learner", "删除学习者")) + "</button></div>";
    }).join("");
    host.innerHTML = rows +
      '<p class="pf-note" style="margin-top:.8rem">' + esc(F("Approximate storage used: {size}", "估算已用存储空间：{size}", { size: fmtBytes(u.total) })) + "</p>" +
      (u.total >= 3 * 1024 * 1024 ? '<p class="pf-err">' + esc(T("Browser storage is getting full. Export a backup before removing data.", "浏览器存储空间即将用满。删除数据前，请先导出备份。")) + "</p>" : "") +
      '<div class="pf-actions">' +
      '<button type="button" class="btn btn-green" id="pfAdd">' + esc(T("Add learner", "添加学习者")) + "</button>" +
      '<button type="button" class="btn btn-line" id="pfExportAll">' + esc(T("Export all learners", "导出所有学习者")) + "</button>" +
      '<button type="button" class="btn btn-line" id="pfImportBtn">' + esc(T("Import backup", "导入备份")) + "</button>" +
      '<input type="file" id="pfFile" accept=".json,application/json" hidden></div>' +
      '<p class="pf-note">' + esc(T("The backup includes saved data only. Save work in other tabs first.", "备份仅包含已保存的数据。请先保存其他标签页中的学习内容。")) + " " +
      esc(T("This file contains learner names and learning progress. Store it safely.", "此文件包含学习者姓名和学习进度，请妥善保管。")) + "</p>" +
      (msg ? '<p class="srs-msg" role="status">' + esc(msg) + "</p>" : "") +
      '<p class="pf-err" id="pfMsgErr" role="alert"></p>';
    $("pfAdd").addEventListener("click", openAddDialog);
    $("pfExportAll").addEventListener("click", exportAllProfiles);
    $("pfImportBtn").addEventListener("click", function () { $("pfFile").click(); });
    $("pfFile").addEventListener("change", function () {
      var f = this.files && this.files[0]; if (!f) return;
      importBackupFile(f, function (m, ok, preview, proceed) {
        if (preview && proceed) { showImportPreview(preview, proceed); return; }
        if (ok) { location.reload(); } else if (m) { var e = $("pfMsgErr"); if (e) e.textContent = m; }
      });
      this.value = "";
    });
    Array.prototype.forEach.call(host.querySelectorAll("[data-rename]"), function (b) {
      b.addEventListener("click", function () { openRenameDialog(b.getAttribute("data-rename")); });
    });
    Array.prototype.forEach.call(host.querySelectorAll("[data-delete]"), function (b) {
      b.addEventListener("click", function () { openDeleteDialog(b.getAttribute("data-delete")); });
    });
  }

  function showImportPreview(preview, proceed) {
    var d = makeDialog("<h3>" + esc(T("Import backup", "导入备份")) + "</h3><p>" + esc(preview) + "</p>" +
      '<p class="pf-note">' + esc(T("Import as additional learners", "导入为新增学习者")) + "</p>");
    var row = document.createElement("div"); row.className = "pf-actions";
    var ok = document.createElement("button"); ok.type = "button"; ok.className = "btn btn-green"; ok.textContent = T("Import as additional learners", "导入为新增学习者");
    var no = document.createElement("button"); no.type = "button"; no.className = "btn btn-line"; no.textContent = T("Cancel", "取消");
    row.appendChild(ok); row.appendChild(no); d.appendChild(row);
    ok.addEventListener("click", function () { d.close(); proceed(); });
    no.addEventListener("click", function () { d.close(); });
    d.showModal();
  }

  function openAddDialog() {
    var d = makeDialog("<h3>" + esc(T("Add learner", "添加学习者")) + "</h3>" +
      '<label for="pfNewName" style="font-weight:800">' + esc(T("Learner name", "学习者姓名或昵称")) + "</label>" +
      '<input class="pf-input" id="pfNewName" type="text" maxlength="60" autocomplete="off">' +
      '<label for="pfNewLang" style="font-weight:800">' + esc(T("Preferred language", "首选语言")) + "</label>" +
      '<select class="pf-input" id="pfNewLang"><option value="en">' + esc(T("English", "英语")) + '</option><option value="zh">' + esc(T("Simplified Chinese", "简体中文")) + "</option></select>" +
      '<p class="pf-note">' + esc(T("New learners start with no progress.", "新学习者将从零进度开始。")) + '</p><p class="pf-err" id="pfAddErr"></p>');
    var row = document.createElement("div"); row.className = "pf-actions";
    var ok = document.createElement("button"); ok.type = "button"; ok.className = "btn btn-green"; ok.textContent = T("Create learner", "创建学习者");
    var no = document.createElement("button"); no.type = "button"; no.className = "btn btn-line"; no.textContent = T("Cancel", "取消");
    row.appendChild(ok); row.appendChild(no); d.appendChild(row);
    no.addEventListener("click", function () { d.close(); });
    ok.addEventListener("click", function () {
      var name = validName($("pfNewName").value);
      if (!name) { $("pfAddErr").textContent = T("Enter a name of 1–40 characters without control characters.", "请输入 1–40 个字符的姓名或昵称，不可包含控制字符。"); return; }
      var reg = VP.readReg(); if (!reg || reg === "invalid") { d.close(); return; }
      var ts = nowIso();
      var p = { id: uuid(), displayName: name, createdAt: ts, updatedAt: ts };
      var raw = {}; raw["vaLang.v1"] = $("pfNewLang").value === "zh" ? "zh" : "en";
      var rawById = {}; rawById[p.id] = raw;
      ok.disabled = true;
      stageProfiles([p], rawById, p.id, "add", reg.revision).then(function () { location.reload(); })
        .catch(function () { $("pfAddErr").textContent = T("Could not save this change. Your last saved value is unchanged.", "无法保存此次更改，上次保存的值未改变。"); ok.disabled = false; });
    });
    d.showModal(); var inp = $("pfNewName"); if (inp) inp.focus();
  }

  function openRenameDialog(id) {
    var reg = VP.readReg(); if (!reg || reg === "invalid") return;
    var p = null; reg.profiles.forEach(function (x) { if (x.id === id) p = x; }); if (!p) return;
    var d = makeDialog("<h3>" + esc(T("Rename learner", "重命名学习者")) + "</h3>" +
      '<label for="pfRenName" style="font-weight:800">' + esc(T("Learner name", "学习者姓名或昵称")) + "</label>" +
      '<input class="pf-input" id="pfRenName" type="text" maxlength="60" autocomplete="off" value="' + esc(p.displayName) + '">' +
      '<p class="pf-meta">' + esc(F("Created {date} · ID {id}", "创建于 {date} · 编号 {id}", { date: fmtDate(p.createdAt), id: p.id.slice(0, 8) })) + '</p><p class="pf-err" id="pfRenErr"></p>');
    var row = document.createElement("div"); row.className = "pf-actions";
    var ok = document.createElement("button"); ok.type = "button"; ok.className = "btn btn-green"; ok.textContent = T("Save", "保存");
    var no = document.createElement("button"); no.type = "button"; no.className = "btn btn-line"; no.textContent = T("Cancel", "取消");
    row.appendChild(ok); row.appendChild(no); d.appendChild(row);
    no.addEventListener("click", function () { d.close(); });
    ok.addEventListener("click", function () {
      var name = validName($("pfRenName").value);
      if (!name) { $("pfRenErr").textContent = T("Enter a name of 1–40 characters without control characters.", "请输入 1–40 个字符的姓名或昵称，不可包含控制字符。"); return; }
      if (name === p.displayName) { d.close(); return; }
      var r2 = VP.readReg(); if (!r2 || r2 === "invalid") { d.close(); return; }
      r2.profiles.forEach(function (x) { if (x.id === id) { x.displayName = name; x.updatedAt = nowIso(); } });
      r2.revision = (r2.revision || 1) + 1; r2.lastTransactionId = uuid();
      try { writeReg(r2); d.close(); renderSwitcher(); renderManager(); renderExamReport(); }
      catch (e) { $("pfRenErr").textContent = T("Could not save this change. Your last saved value is unchanged.", "无法保存此次更改，上次保存的值未改变。"); }
    });
    d.showModal(); var inp = $("pfRenName"); if (inp) { inp.focus(); inp.select(); }
  }

  function openDeleteDialog(id) {
    var reg = VP.readReg(); if (!reg || reg === "invalid") return;
    if (reg.profiles.length <= 1) { renderManager(T("You cannot delete the last learner.", "无法删除最后一位学习者。")); return; }
    var p = null; reg.profiles.forEach(function (x) { if (x.id === id) p = x; }); if (!p) return;
    var d = makeDialog("<h3>" + esc(T("Delete learner", "删除学习者")) + "</h3>" +
      "<p>" + esc(F("Delete {name}? This permanently removes this learner’s progress from this browser. Exported backups are not deleted.", "要删除 {name} 吗？这将永久删除当前浏览器中该学习者的进度，但不会删除已导出的备份。", { name: p.displayName })) + "</p>" +
      '<p class="pf-meta">' + esc(F("Created {date} · ID {id}", "创建于 {date} · 编号 {id}", { date: fmtDate(p.createdAt), id: p.id.slice(0, 8) })) + "</p>" +
      '<label for="pfDelType" style="font-weight:800">' + esc(F("Type {name} exactly to confirm.", "请准确输入 {name} 以确认。", { name: p.displayName })) + "</label>" +
      '<input class="pf-input" id="pfDelType" type="text" autocomplete="off"><p class="pf-err" id="pfDelErr"></p>');
    var row = document.createElement("div"); row.className = "pf-actions";
    var ok = document.createElement("button"); ok.type = "button"; ok.className = "btn"; ok.style.background = "var(--bad)"; ok.style.color = "#fff"; ok.textContent = T("Delete learner", "删除学习者");
    var no = document.createElement("button"); no.type = "button"; no.className = "btn btn-line"; no.textContent = T("Cancel", "取消");
    row.appendChild(ok); row.appendChild(no); d.appendChild(row);
    no.addEventListener("click", function () { d.close(); });
    ok.addEventListener("click", function () {
      if ($("pfDelType").value !== p.displayName) { $("pfDelErr").textContent = F("Type {name} exactly to confirm.", "请准确输入 {name} 以确认。", { name: p.displayName }); return; }
      var r2 = VP.readReg(); if (!r2 || r2 === "invalid" || r2.profiles.length <= 1) { d.close(); return; }
      var wasActive = r2.activeProfileId === id;
      r2.profiles = r2.profiles.filter(function (x) { return x.id !== id; });
      if (!r2.profiles.length) { d.close(); return; }
      r2.pendingDeleteProfileIds = (r2.pendingDeleteProfileIds || []).concat([id]);
      if (wasActive) {
        var rest = r2.profiles.slice().sort(function (a, b) { return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : (a.id < b.id ? -1 : 1); });
        r2.activeProfileId = rest[0].id;
      }
      r2.revision = (r2.revision || 1) + 1; r2.lastTransactionId = uuid();
      try { writeReg(r2); } catch (e) { $("pfDelErr").textContent = T("Could not save this change. Your last saved value is unchanged.", "无法保存此次更改，上次保存的值未改变。"); return; }
      clearNamespace(id);
      var r3 = VP.readReg();
      if (r3 && r3 !== "invalid") { r3.pendingDeleteProfileIds = (r3.pendingDeleteProfileIds || []).filter(function (x) { return x !== id; }); r3.revision = (r3.revision || 1) + 1; r3.lastTransactionId = uuid(); try { writeReg(r3); } catch (e) {} }
      d.close();
      if (wasActive) location.reload(); else { renderSwitcher(); renderManager(); }
    });
    d.showModal(); var inp = $("pfDelType"); if (inp) inp.focus();
  }

  /* --- full-screen gates: migration / first run / recovery --- */
  function showGate(kind) {
    var ov = document.createElement("div");
    ov.className = "pf-overlay open"; ov.id = "pfGate";
    var inner = "";
    if (kind === "recovery") {
      inner = "<h3>" + esc(T("Stored profile information could not be read safely. Export a recovery backup before making changes.", "无法安全读取已保存的学习者资料。更改数据前，请先导出恢复备份。")) + "</h3>" +
        '<div class="pf-actions"><button type="button" class="btn btn-green" id="pfGateRecovery">' + esc(T("Export recovery backup", "导出恢复备份")) + "</button>" +
        '<button type="button" class="btn btn-line" id="pfGateReload">' + esc(T("Reload", "重新加载")) + "</button></div>";
    } else if (kind === "migration") {
      var defName = langIdx() ? "学习者 1" : "Learner 1";
      inner = "<h3>" + esc(T("Learner profiles", "学习者资料")) + "</h3>" +
        "<p>" + esc(T("This site now supports more than one learner on this device. Your existing progress will be moved — unchanged, exactly as saved — into your first learner profile.", "本站现在支持在此设备上保存多位学习者。您现有的进度将被原封不动地移入您的第一位学习者资料中。")) + "</p>" +
        "<p>" + esc(T("Exam data is stored only in this browser on this device. Clearing browser data may erase it.", "模拟考试数据仅保存在此设备的当前浏览器中。清除浏览器数据可能会将其删除。")) + "</p>" +
        '<label for="pfGateName" style="font-weight:800">' + esc(T("Learner name", "学习者姓名或昵称")) + '</label><input class="pf-input" id="pfGateName" type="text" value="' + esc(defName) + '">' +
        '<label class="pf-check"><input type="checkbox" id="pfGateTabs"> <span>' + esc(T("I have closed all other tabs and windows for this site.", "我已关闭此网站的所有其他标签页和窗口。")) + "</span></label>" +
        '<p class="pf-note">' + esc(T("Close all other tabs and windows for this site before continuing.", "继续前，请关闭此网站的所有其他标签页和窗口。")) + '</p><p class="pf-err" id="pfGateErr"></p>' +
        '<div class="pf-actions"><button type="button" class="btn btn-green" id="pfGateGo">' + esc(T("Continue", "继续")) + "</button></div>" +
        '<p class="pf-note" id="pfGateBusy" hidden>' + esc(T("Preparing learner profiles. Do not close this page.", "正在准备学习者资料，请勿关闭此页面。")) + "</p>";
    } else {
      inner = "<h3>" + esc(T("Learner profiles", "学习者资料")) + "</h3>" +
        "<p>" + esc(T("Learners are stored only in this browser. They are not accounts or password-protected.", "学习者资料仅保存在当前浏览器中，不是账户，也没有密码保护。")) + "</p>" +
        '<div class="pf-actions"><button type="button" class="btn btn-green" id="pfGateStart">' + esc(T("Start with Learner 1", "使用“学习者 1”开始")) + "</button>" +
        '<button type="button" class="btn btn-line" id="pfGateImport">' + esc(T("Import backup", "导入备份")) + '</button><input type="file" id="pfGateFile" accept=".json,application/json" hidden></div>' +
        '<p class="pf-err" id="pfGateErr"></p>';
    }
    ov.innerHTML = '<div class="pf-card" role="dialog" aria-modal="true">' + inner + "</div>";
    document.body.appendChild(ov);
    if (kind === "recovery") {
      $("pfGateRecovery").addEventListener("click", function () { exportRecovery(); });
      $("pfGateReload").addEventListener("click", function () { location.reload(); });
    } else if (kind === "migration") {
      $("pfGateGo").addEventListener("click", function () {
        if (!$("pfGateTabs").checked) { $("pfGateErr").textContent = T("Close all other tabs and windows for this site before continuing.", "继续前，请关闭此网站的所有其他标签页和窗口。"); return; }
        var name = validName($("pfGateName").value) || (langIdx() ? "学习者 1" : "Learner 1");
        $("pfGateBusy").hidden = false; $("pfGateGo").disabled = true;
        doMigration(name).then(function () { location.reload(); }).catch(function () {
          $("pfGateBusy").hidden = true; $("pfGateGo").disabled = false;
          $("pfGateErr").textContent = T("Profiles could not be enabled. Your original progress is unchanged. Export a backup, free storage, and retry.", "无法启用多学习者功能。原有进度未改变。请导出备份、释放存储空间后重试。");
          try { VP.rawRem(JRN); } catch (e) {}
          var pfxKeys = VP.allKeys().filter(function (k) { return k.indexOf("vaP_") === 0; });
          pfxKeys.forEach(function (k) { try { VP.rawRem(k); } catch (e) {} });
        });
      });
    } else {
      $("pfGateStart").addEventListener("click", function () {
        var ts = nowIso();
        var p = { id: uuid(), displayName: langIdx() ? "学习者 1" : "Learner 1", createdAt: ts, updatedAt: ts };
        var rawById = {}; rawById[p.id] = {};
        stageProfiles([p], rawById, p.id, "add", null).then(function () { location.reload(); })
          .catch(function () { $("pfGateErr").textContent = T("Could not save this change. Your last saved value is unchanged.", "无法保存此次更改，上次保存的值未改变。"); });
      });
      $("pfGateImport").addEventListener("click", function () { $("pfGateFile").click(); });
      $("pfGateFile").addEventListener("change", function () {
        var f = this.files && this.files[0]; if (!f) return;
        importBackupFile(f, function (m, ok, preview, proceed) {
          if (preview && proceed) { showImportPreview(preview, proceed); return; }
          if (ok) location.reload(); else if (m) $("pfGateErr").textContent = m;
        });
        this.value = "";
      });
    }
  }

  /* ============================ EXAM ENGINE ============================
     Subject- and grade/course-based SOL practice exams ( brief:
     subject -> grade/course -> exam). New runs sample ONLY from the
     selected profile's explicitly approved lessons — never from another
     subject, grade, or profile to reach a target count.
     ------------------------------------------------------------------
     PHASE 1 INVENTORY (audited in-repo from window.LESSONS, the same
     bank buildBank() reads; every question validated through the
     eight-field DTO adapter normalizeQuestion() and deduplicated by
     fingerprint; counts below are the audited results):
     Courses are the site's own 13 courses (see COURSES / courseLessons
     in index.html): 6/7/8 x math, english, science, history, plus
     8-algebra (Algebra I). 73 lessons, 7 valid questions each, 511
     valid questions total, 0 invalid, 0 duplicate fingerprints.
       6-math      lessons 0-5    -> math.g6
       7-math      lessons 21-26  -> math.g7
       8-math      lessons 42-47  -> math.g8
       6-english   lessons 6-10   -> reading.g6 admits 6,7,8 only
       7-english   lessons 27-31  -> reading.g7 admits 27,28,30 only
       8-english   lessons 48-52  -> reading.g8 admits 48,49,51,52
       6-science   lessons 11-15  -> science.g6 (curriculum practice)
       7-science   lessons 32-36  -> science.g7 (curriculum practice)
       8-science   lessons 53-58  -> science.g8
       6-history   lessons 16-20  -> history.g6 (curriculum, USI)
       7-history   lessons 37-41  -> history.g7 (curriculum, USII)
       8-history   lessons 59-63  -> civics.g8 (all five lessons are
                     Civics/Economics per their SOL fields: Civics
                     Foundations/Constitution/Citizenship/Virginia
                     Government + Economics Personal Finance)
       8-algebra   lessons 64-72  -> algebra1.eoc (9 lessons, alg flag)
     Reading audit: admitted lessons are tagged Reading, Poetry,
     Literature, Media Literacy, or Vocabulary (word study is part of
     the Reading SOL). Excluded as not Reading-assessment material:
     lesson-9 (Writing), lesson-10 (Research), lesson-29 (Writing),
     lesson-31 (Grammar), lesson-50 (Writing) — 5 lessons / 35
     questions accounted for as ineligible, so profile pools total
     476 of the bank's 511 questions.
     Audited profile pools (N = valid distinct questions,
     Q = min(45, N), minutes = 2 x Q):
       math.g6 N42 Q42 84m · math.g7 N42 Q42 84m · math.g8 N42 Q42 84m
       reading.g6 N21 Q21 42m · reading.g7 N21 Q21 42m
       reading.g8 N28 Q28 56m
       science.g6 N35 Q35 70m · science.g7 N35 Q35 70m
       science.g8 N42 Q42 84m
       history.g6 N35 Q35 70m · history.g7 N35 Q35 70m
       civics.g8 N35 Q35 70m · algebra1.eoc N63 Q45 90m
     Counts are recomputed live from the bank on every landing render;
     if the bank changes, Q and duration follow the same policy and a
     pool that reaches 0 shows the unavailable reason instead of an
     exam. These are site practice limits — not official SOL timing,
     item counts, blueprint weighting, or coverage claims.
     ================================================================== */
  var EXAM_KEY = "vaSolExam.v1";
  var PROFILE_VERSION = 1;
  var SAMPLER_VERSION = "profile-stratified-v3";
  var EXAM_CFG = { maxQuestions: 45, secondsPerQuestion: 120, samplerVersion: SAMPLER_VERSION, prngVersion: "mulberry32-v1", scoringVersion: "linear-600-v1" };
  var SUBJECTS = ["math", "science", "english", "historyCivics", "algebra1"];

  var EXAM_PROFILES = [
    { id: "math.g6", subject: "math", grade: 6, assessmentLevel: "grade", assessmentKind: "sol-practice", title: { en: "Grade 6 Math", zh: "六年级数学" }, courseIds: ["6-math"], lessonIds: ["lesson-0", "lesson-1", "lesson-2", "lesson-3", "lesson-4", "lesson-5"] },
    { id: "math.g7", subject: "math", grade: 7, assessmentLevel: "grade", assessmentKind: "sol-practice", title: { en: "Grade 7 Math", zh: "七年级数学" }, courseIds: ["7-math"], lessonIds: ["lesson-21", "lesson-22", "lesson-23", "lesson-24", "lesson-25", "lesson-26"] },
    { id: "math.g8", subject: "math", grade: 8, assessmentLevel: "grade", assessmentKind: "sol-practice", title: { en: "Grade 8 Math", zh: "八年级数学" }, courseIds: ["8-math"], lessonIds: ["lesson-42", "lesson-43", "lesson-44", "lesson-45", "lesson-46", "lesson-47"] },
    { id: "reading.g6", subject: "reading", grade: 6, assessmentLevel: "grade", assessmentKind: "sol-practice", title: { en: "Grade 6 Reading", zh: "六年级阅读" }, courseIds: ["6-english"], lessonIds: ["lesson-6", "lesson-7", "lesson-8"] },
    { id: "reading.g7", subject: "reading", grade: 7, assessmentLevel: "grade", assessmentKind: "sol-practice", title: { en: "Grade 7 Reading", zh: "七年级阅读" }, courseIds: ["7-english"], lessonIds: ["lesson-27", "lesson-28", "lesson-30"] },
    { id: "reading.g8", subject: "reading", grade: 8, assessmentLevel: "grade", assessmentKind: "sol-practice", title: { en: "Grade 8 Reading", zh: "八年级阅读" }, courseIds: ["8-english"], lessonIds: ["lesson-48", "lesson-49", "lesson-51", "lesson-52"] },
    { id: "science.g6", subject: "science", grade: 6, assessmentLevel: "grade", assessmentKind: "curriculum-practice", title: { en: "Grade 6 Science", zh: "六年级科学" }, courseIds: ["6-science"], lessonIds: ["lesson-11", "lesson-12", "lesson-13", "lesson-14", "lesson-15"] },
    { id: "science.g7", subject: "science", grade: 7, assessmentLevel: "grade", assessmentKind: "curriculum-practice", title: { en: "Grade 7 Science", zh: "七年级科学" }, courseIds: ["7-science"], lessonIds: ["lesson-32", "lesson-33", "lesson-34", "lesson-35", "lesson-36"] },
    { id: "science.g8", subject: "science", grade: 8, assessmentLevel: "grade", assessmentKind: "sol-practice", title: { en: "Grade 8 Science", zh: "八年级科学" }, courseIds: ["8-science"], lessonIds: ["lesson-53", "lesson-54", "lesson-55", "lesson-56", "lesson-57", "lesson-58"] },
    { id: "history.g6", subject: "historyCivics", grade: 6, assessmentLevel: "grade", assessmentKind: "curriculum-practice", title: { en: "Grade 6 History", zh: "六年级历史" }, courseIds: ["6-history"], lessonIds: ["lesson-16", "lesson-17", "lesson-18", "lesson-19", "lesson-20"] },
    { id: "history.g7", subject: "historyCivics", grade: 7, assessmentLevel: "grade", assessmentKind: "curriculum-practice", title: { en: "Grade 7 History", zh: "七年级历史" }, courseIds: ["7-history"], lessonIds: ["lesson-37", "lesson-38", "lesson-39", "lesson-40", "lesson-41"] },
    { id: "civics.g8", subject: "historyCivics", grade: 8, assessmentLevel: "grade", assessmentKind: "sol-practice", title: { en: "Civics & Economics", zh: "公民与经济" }, courseIds: ["8-history"], lessonIds: ["lesson-59", "lesson-60", "lesson-61", "lesson-62", "lesson-63"] },
    { id: "algebra1.eoc", subject: "algebra1", grade: null, assessmentLevel: "eoc", assessmentKind: "sol-practice", title: { en: "Algebra I", zh: "代数 I" }, courseIds: ["8-algebra"], lessonIds: ["lesson-64", "lesson-65", "lesson-66", "lesson-67", "lesson-68", "lesson-69", "lesson-70", "lesson-71", "lesson-72"] }
  ];
  var PROFILE_BY_COMBO = {
    "math|6": "math.g6", "math|7": "math.g7", "math|8": "math.g8",
    "reading|6": "reading.g6", "reading|7": "reading.g7", "reading|8": "reading.g8",
    "science|6": "science.g6", "science|7": "science.g7", "science|8": "science.g8",
    "historyCivics|6": "history.g6", "historyCivics|7": "history.g7", "historyCivics|8": "civics.g8",
    "algebra1|eoc": "algebra1.eoc"
  };
  var PICKER_SUBJECTS = [
    { key: "math", en: "Math", zh: "数学" },
    { key: "reading", en: "Reading / English", zh: "阅读／英语" },
    { key: "science", en: "Science", zh: "科学" },
    { key: "historyCivics", en: "History / Civics", zh: "历史／公民" },
    { key: "algebra1", en: "Algebra I", zh: "代数 I" }
  ];
  function profileById(id) { for (var i = 0; i < EXAM_PROFILES.length; i++) if (EXAM_PROFILES[i].id === id) return EXAM_PROFILES[i]; return null; }
  function profileFor(subject, gradeKey) { var id = PROFILE_BY_COMBO[subject + "|" + gradeKey]; return id ? profileById(id) : null; }
  function profileTitleOf(p) { return p.title[langIdx() ? "zh" : "en"]; }
  function recordProfileLabel(rec) {
    if (rec && rec.profileTitle && (rec.profileTitle.en || rec.profileTitle.zh)) return langIdx() ? (rec.profileTitle.zh || rec.profileTitle.en) : (rec.profileTitle.en || rec.profileTitle.zh);
    if (rec && rec.profileId) { var p = profileById(rec.profileId); if (p) return profileTitleOf(p); return rec.profileId; }
    return T("SOL practice exam", "SOL 模拟考试");
  }
  function recordTotal(rec) {
    if (rec && typeof rec.questionCount === "number" && rec.questionCount > 0) return rec.questionCount;
    if (rec && rec.selection && Array.isArray(rec.selection.orderedQuestionIds)) return rec.selection.orderedQuestionIds.length;
    return 45;
  }
  function recordDurationSec(rec) {
    if (rec && typeof rec.timeLimitSeconds === "number" && rec.timeLimitSeconds > 0) return rec.timeLimitSeconds;
    if (rec && typeof rec.durationSec === "number" && rec.durationSec > 0) return rec.durationSec;
    return recordTotal(rec) * EXAM_CFG.secondsPerQuestion;
  }
  function profileMetaOf(rec) {
    return {
      recordSchemaVersion: 2,
      profileId: rec.profileId || null,
      profileVersion: rec.profileVersion == null ? null : rec.profileVersion,
      subject: rec.subject || null,
      grade: rec.grade == null ? null : rec.grade,
      assessmentLevel: rec.assessmentLevel || null,
      assessmentKind: rec.assessmentKind || null,
      profileTitle: rec.profileTitle || null,
      questionCount: recordTotal(rec),
      timeLimitSeconds: recordDurationSec(rec)
    };
  }

  /* Question-bank adapter.
     The lesson bank's real DTO (see the main Check renderer and the
     mistake-worksheet adapter in index.html) is an 8-field tuple:
       q[0] prompt EN (string)    q[1] prompt ZH (string)
       q[2] options [[EN,ZH],...] q[3] correct-option index (number)
       q[4] explanation EN        q[5] explanation ZH
       q[6] hint EN (optional)    q[7] hint ZH (optional)
     The exam engine internally uses a canonical 4-field form:
       [ [promptEN, promptZH], options, answerIndex, [whyEN, whyZH] ]
     Normalize here, at the single entry point, so startExam and the
     results review (which both read the canonical form) work. */
  function normalizeQuestion(q) {
    if (!Array.isArray(q)) return null;
    /* Real bank shape: separate EN/ZH prompt strings at 0/1. */
    if (typeof q[0] === "string" && typeof q[1] === "string" &&
        Array.isArray(q[2]) && typeof q[3] === "number") {
      var opts = q[2];
      if (!q[0] || opts.length < 2) return null;
      for (var i = 0; i < opts.length; i++) {
        if (!Array.isArray(opts[i]) || typeof opts[i][0] !== "string" || !opts[i][0]) return null;
      }
      if (!isFinite(q[3]) || Math.floor(q[3]) !== q[3] || q[3] < 0 || q[3] >= opts.length) return null;
      return [[q[0], q[1]], opts, q[3],
              [typeof q[4] === "string" ? q[4] : "", typeof q[5] === "string" ? q[5] : ""]];
    }
    /* Canonical shape (defensive: accept it if the bank ever ships it). */
    if (Array.isArray(q[0]) && Array.isArray(q[1]) && typeof q[2] === "number") {
      if (!q[0][0] || !Array.isArray(q[1]) || q[1].length < 2) return null;
      if (!isFinite(q[2]) || Math.floor(q[2]) !== q[2] || q[2] < 0 || q[2] >= q[1].length) return null;
      return [q[0], q[1], q[2], Array.isArray(q[3]) ? q[3] : ["", ""]];
    }
    return null;
  }
  function buildBank() {
    var bank = [];
    var lessons = window.LESSONS || [];
    lessons.forEach(function (L, li) {
      if (!L || !L.q) return;
      var subj = L.alg ? "algebra1" : (L.s === "history" ? "historyCivics" : L.s);
      if (SUBJECTS.indexOf(subj) < 0) return;
      var band = L.alg ? "course" : String(L.g);
      L.q.forEach(function (q, qi) {
        var norm = normalizeQuestion(q);
        if (!norm) return;
        bank.push({ questionId: "L" + li + "Q" + qi, lessonId: "lesson-" + li, subject: subj, gradeBand: band, fingerprint: fnv(JSON.stringify(q)), question: norm });
      });
    });
    return bank;
  }
  function buildProfilePool(profile, bank) {
    var allowed = {};
    profile.lessonIds.forEach(function (id) { allowed[id] = true; });
    var seen = {}, pool = [];
    bank.forEach(function (b) {
      if (!allowed[b.lessonId]) return;
      if (seen[b.fingerprint]) return;
      seen[b.fingerprint] = true;
      pool.push(b);
    });
    pool.sort(function (a, b) { return a.questionId < b.questionId ? -1 : a.questionId > b.questionId ? 1 : 0; });
    return pool;
  }
  function poolInfo(profile, bank) {
    var N = buildProfilePool(profile, bank).length;
    var Q = Math.min(EXAM_CFG.maxQuestions, N);
    return { N: N, Q: Q, minutes: 2 * Q, durationSec: Q * EXAM_CFG.secondsPerQuestion };
  }
  function bankVersion(bank) {
    var manifest = bank.map(function (b) { return { questionId: b.questionId, lessonId: b.lessonId, subject: b.subject, gradeBand: b.gradeBand, fingerprint: b.fingerprint }; })
      .sort(function (a, b) { return a.questionId < b.questionId ? -1 : a.questionId > b.questionId ? 1 : 0; });
    return "sha256:" + fnv(JSON.stringify(manifest)) + fnv(JSON.stringify(manifest).split("").reverse().join(""));
  }
  function mulberry32(seed) {
    var state = seed >>> 0;
    return function () {
      state = (state + 0x6D2B79F5) >>> 0;
      var t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffleArr(values, random) {
    var result = values.slice();
    for (var i = result.length - 1; i > 0; i--) { var j = Math.floor(random() * (i + 1)); var tmp = result[i]; result[i] = result[j]; result[j] = tmp; }
    return result;
  }
  /* Profile-scoped sampler: stratify Q across the profile's own
     lessons (floor quota + seeded remainder), rank candidates within
     each lesson by exposure age — never-exposed first, then oldest
     most-recent exposure first (the brief's "reuse exposed questions
     from oldest exposure to newest"), with appearance count and a
     seeded rank breaking ties — redistribute any lesson shortfall only
     to other lessons in the SAME profile, then apply a seeded final
     shuffle. Deterministic for identical profile, bank, seed, and
     exposure inputs; never borrows off-profile.
     Ranking note: recency must be the PRIMARY key. With appearance
     count primary (v2), a question seen once in the most recent exam
     outranked a question last seen two exams ago, so the marginal
     slots went to the freshest questions even though total overlap
     still hit its theoretical minimum — the overlap metric alone
     cannot see that failure. */
  function sampleProfileExam(pool, Q, seed, recentExposure) {
    if (!pool.length || Q <= 0) return null;
    var random = mulberry32(seed);
    var seenCount = {}, latestIdx = {};
    (recentExposure || []).forEach(function (rec, idx) {
      (rec.shownQuestionIds || []).forEach(function (qid) {
        seenCount[qid] = (seenCount[qid] || 0) + 1;
        if (latestIdx[qid] === undefined) latestIdx[qid] = idx;
      });
    });
    var byLesson = {}, lessonIds = [];
    pool.forEach(function (b) {
      if (!byLesson[b.lessonId]) { byLesson[b.lessonId] = []; lessonIds.push(b.lessonId); }
      byLesson[b.lessonId].push(b);
    });
    lessonIds.sort();
    var ranked = {};
    lessonIds.forEach(function (lid) {
      var cands = byLesson[lid].slice();
      var sh = shuffleArr(cands, random);
      var rank = {}; sh.forEach(function (b, i) { rank[b.questionId] = i; });
      ranked[lid] = cands.sort(function (a, b) {
        var la = latestIdx[a.questionId] === undefined ? 9999 : latestIdx[a.questionId];
        var lb = latestIdx[b.questionId] === undefined ? 9999 : latestIdx[b.questionId];
        if (la !== lb) return lb - la;
        var ca = seenCount[a.questionId] || 0, cb = seenCount[b.questionId] || 0;
        if (ca !== cb) return ca - cb;
        return rank[a.questionId] - rank[b.questionId];
      });
    });
    var L = lessonIds.length;
    var base = Math.floor(Q / L), rem = Q - base * L;
    var lessonOrder = shuffleArr(lessonIds, random);
    var quota = {}; lessonIds.forEach(function (lid) { quota[lid] = base; });
    for (var i = 0; i < rem; i++) quota[lessonOrder[i % L]]++;
    var picked = [], pickedIds = {};
    lessonIds.forEach(function (lid) {
      var take = Math.min(quota[lid], ranked[lid].length);
      for (var j = 0; j < take; j++) { picked.push(ranked[lid][j]); pickedIds[ranked[lid][j].questionId] = true; }
    });
    if (picked.length < Q) {
      var remByLesson = {};
      lessonIds.forEach(function (lid) { remByLesson[lid] = ranked[lid].filter(function (b) { return !pickedIds[b.questionId]; }); });
      var progressed = true;
      while (picked.length < Q && progressed) {
        progressed = false;
        for (var k = 0; k < lessonOrder.length && picked.length < Q; k++) {
          var lid2 = lessonOrder[k];
          if (remByLesson[lid2].length) { var nb = remByLesson[lid2].shift(); picked.push(nb); pickedIds[nb.questionId] = true; progressed = true; }
        }
      }
    }
    if (picked.length < Q) return null;
    var lessonCounts = {};
    picked.forEach(function (b) { lessonCounts[b.lessonId] = (lessonCounts[b.lessonId] || 0) + 1; });
    return { items: shuffleArr(picked, random), lessonCounts: lessonCounts };
  }

  /* --- storage: same vaSolExam.v1 envelope. Only subject-based exam
     records are kept. The retired cross-subject format carried no
     profileId (or one that is not among EXAM_PROFILES), so any active
     or history record that does not name a real subject profile is
     dropped on load and the cleaned store is written back. Those
     dropped records were practice estimates only — exam results never
     feed mastery, FSRS, or lesson completion — so no learning data is
     affected. Subject-based records pass through untouched. --- */
  function isSubjectExamRecord(r) {
    return !!r && typeof r === "object" && !!profileById(r.profileId);
  }
  function readExamStore() {
    try {
      var r = LS.getItem(EXAM_KEY);
      if (!r) return { schemaVersion: 1, revision: 0, active: null, history: [] };
      var o = JSON.parse(r);
      if (!o || o.schemaVersion !== 1 || !Array.isArray(o.history)) return "invalid";
      var changed = false;
      if (o.active && !isSubjectExamRecord(o.active)) { o.active = null; changed = true; }
      var kept = o.history.filter(isSubjectExamRecord);
      if (kept.length !== o.history.length) { o.history = kept; changed = true; }
      if (changed) { try { writeExamStore(o); } catch (e) { /* keep in-memory cleaned copy; original data untouched on failure */ } }
      return o;
    } catch (e) { return "invalid"; }
  }
  function writeExamStore(s) {
    s.revision = (s.revision || 0) + 1;
    var str = JSON.stringify(s);
    if (2 * (EXAM_KEY.length + str.length) > 3 * 1024 * 1024) throw new Error("quota-budget");
    LS.setItem(EXAM_KEY, str);
  }
  function answeredOf(resp) { return resp !== null && resp !== undefined; }
  function answeredCount(active) { var n = 0; active.selection.orderedQuestionIds.forEach(function (q) { if (answeredOf(active.responses[q])) n++; }); return n; }

  var examUI = { view: "landing", prepared: null, sessionId: null, filter: "all", timer: null, lastTickPersist: 0, resultsId: null, selSubject: "math", selGrade: "6", confirmProfile: null, histSubject: "all", histProfile: "all" };

  function recentExposureOf(store, profileId) {
    return store.history.filter(function (h) { return h.profileId === profileId; }).slice(0, 3).map(function (h) { return { sessionId: h.id, status: h.status, shownQuestionIds: h.shownQuestionIds || [] }; });
  }
  function prepareExam(store, profile) {
    var bank = buildBank();
    var pool = buildProfilePool(profile, bank);
    var N = pool.length;
    if (!N) return null;
    var Q = Math.min(EXAM_CFG.maxQuestions, N);
    var seedArr = new Uint32Array(1);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(seedArr); else seedArr[0] = Math.floor(Math.random() * 4294967296);
    var sel = sampleProfileExam(pool, Q, seedArr[0], recentExposureOf(store, profile.id));
    if (!sel) return null;
    return { bank: bank, seed: seedArr[0], sel: sel, N: N, Q: Q, durationSec: Q * EXAM_CFG.secondsPerQuestion, profileId: profile.id };
  }
  function startExam(profile) {
    var store = readExamStore();
    if (!store || store === "invalid" || store.active) { examUI.view = "landing"; renderExam(); return; }
    var prep = examUI.prepared && examUI.prepared.profileId === profile.id && examUI.prepared.storeRev === store.revision ? examUI.prepared : null;
    if (!prep) { prep = prepareExam(store, profile); if (!prep) { examUI.view = "landing"; renderExam(T("No eligible questions in this bank.", "当前题库没有符合条件的题目。")); return; } prep.storeRev = store.revision; }
    var startedAt = new Date();
    var durationSec = prep.durationSec;
    var active = {
      id: uuid(), status: "inProgress", choiceSeed: vaChoiceSeed(),
      recordSchemaVersion: 2, profileId: profile.id, profileVersion: PROFILE_VERSION,
      subject: profile.subject, grade: profile.grade, assessmentLevel: profile.assessmentLevel, assessmentKind: profile.assessmentKind,
      profileTitle: { en: profile.title.en, zh: profile.title.zh },
      questionCount: prep.Q, timeLimitSeconds: durationSec,
      startedAt: startedAt.toISOString(), durationSec: durationSec,
      deadlineAtMs: startedAt.getTime() + durationSec * 1000, lastObservedAtMs: startedAt.getTime(),
      warning5MinShown: false, timingAnomaly: false, languageAtStart: langIdx() ? "zh-Hans" : "en",
      selection: {
        profileId: profile.id, profileVersion: PROFILE_VERSION, seed: prep.seed, samplerVersion: SAMPLER_VERSION, prngVersion: EXAM_CFG.prngVersion,
        bankVersion: bankVersion(prep.bank), lessonCounts: prep.sel.lessonCounts, recentExposure: recentExposureOf(store, profile.id),
        orderedQuestionIds: prep.sel.items.map(function (b) { return b.questionId; })
      },
      questions: prep.sel.items.map(function (b) {
        return { questionId: b.questionId, lessonId: b.lessonId, subject: b.subject, gradeBand: b.gradeBand, fingerprint: b.fingerprint, prompt: b.question[0], options: b.question[1], answer: b.question[2], why: b.question[3] };
      }),
      responses: {}, shownQuestionIds: [], flaggedQuestionIds: [], currentIndex: 0, screen: "question"
    };
    active.selection.orderedQuestionIds.forEach(function (q) { active.responses[q] = null; });
    store.active = active;
    try { writeExamStore(store); } catch (e) { examUI.view = "landing"; renderExam(T("The exam could not be saved and has not started. Retry or export a backup.", "无法保存考试，考试尚未开始。请重试或导出备份。")); return; }
    examUI.view = "session"; examUI.sessionId = active.id; examUI.prepared = null;
    markShown(active.id, active.selection.orderedQuestionIds[0]);
    renderExam();
  }
  function mutateActive(fn) {
    var store = readExamStore();
    if (!store || store === "invalid" || !store.active) return null;
    var a = store.active;
    var res = fn(a, store);
    if (res === false) return null;
    try { writeExamStore(store); } catch (e) { return null; }
    return a;
  }
  function markShown(sessionId, qid) {
    mutateActive(function (a) { if (a.id !== sessionId) return false; if (a.shownQuestionIds.indexOf(qid) < 0) a.shownQuestionIds.push(qid); });
  }
  function effectiveNow(a) { return Math.max(Date.now(), a.lastObservedAtMs); }
  function remainingSec(a) { return Math.max(0, Math.ceil((a.deadlineAtMs - effectiveNow(a)) / 1000)); }
  function fmtClock(sec) { var m = Math.floor(sec / 60), s = sec % 60; return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s; }
  function fmtElapsed(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return langIdx() ? (m + " 分 " + s + " 秒") : (m + " min " + s + " sec");
  }

  function finalizeExam(requested) {
    var store = readExamStore();
    if (!store || store === "invalid" || !store.active) { examUI.view = "landing"; renderExam(); return; }
    var a = store.active;
    var now = effectiveNow(a);
    var status = requested;
    if (requested === "submitted" && now >= a.deadlineAtMs) status = "timedOut";
    var total = recordTotal(a);
    var dur = recordDurationSec(a);
    var finishedAtMs = status === "timedOut" ? a.deadlineAtMs : Math.min(now, a.deadlineAtMs);
    var elapsedSec = Math.max(0, Math.min(dur, Math.floor((finishedAtMs - Date.parse(a.startedAt)) / 1000)));
    var meta = profileMetaOf(a);
    var entry;
    if (status === "abandoned") {
      entry = {
        id: a.id, status: status, startedAt: a.startedAt, finishedAt: new Date(finishedAtMs).toISOString(), recordedAt: nowIso(),
        elapsedSec: elapsedSec, timingAnomaly: !!a.timingAnomaly, languageAtStart: a.languageAtStart, selection: a.selection,
        questionResults: a.questions.map(function (q) { return { questionId: q.questionId, lessonId: q.lessonId, subject: q.subject, gradeBand: q.gradeBand, fingerprint: q.fingerprint, response: a.responses[q.questionId], correct: null }; }),
        shownQuestionIds: a.shownQuestionIds.slice(), flaggedQuestionIds: a.flaggedQuestionIds.slice(),
        answeredCount: answeredCount(a), correctCount: null, questionCount: total, rawPercent: null, scoringVersion: EXAM_CFG.scoringVersion, subjectResults: null
      };
    } else {
      var correct = 0;
      var results = a.questions.map(function (q) {
        var resp = a.responses[q.questionId];
        var ok = answeredOf(resp) && resp === q.answer;
        if (ok) correct++;
        return { questionId: q.questionId, lessonId: q.lessonId, subject: q.subject, gradeBand: q.gradeBand, fingerprint: q.fingerprint, response: resp, correct: ok };
      });
      entry = {
        id: a.id, status: status, startedAt: a.startedAt, finishedAt: new Date(finishedAtMs).toISOString(), recordedAt: nowIso(),
        elapsedSec: elapsedSec, timingAnomaly: !!a.timingAnomaly, languageAtStart: a.languageAtStart, selection: a.selection,
        questionResults: results, shownQuestionIds: a.shownQuestionIds.slice(), flaggedQuestionIds: a.flaggedQuestionIds.slice(),
        answeredCount: answeredCount(a), correctCount: correct, questionCount: total,
        rawPercent: Math.round(100 * correct / total), scaledEstimate: Math.round(600 * correct / total),
        scoringVersion: EXAM_CFG.scoringVersion, subjectResults: null
      };
    }
    Object.keys(meta).forEach(function (k) { entry[k] = meta[k]; });
    entry.questionCount = total;
    entry.timeLimitSeconds = dur;
    store.active = null;
    store.history = [entry].concat(store.history).slice(0, 20);
    try { writeExamStore(store); } catch (e) { renderExam(T("Your result has not been saved. Keep this page open and retry or download it. Closing this page may lose this result.", "成绩尚未保存。请保持此页面打开，然后重试或下载成绩。关闭页面可能导致本次成绩丢失。")); return; }
    stopTimer();
    examUI.view = "results"; examUI.resultsId = entry.id; examUI.sessionId = null;
    renderExam(); renderExamReport();
    var alert = $("examAlert"); if (alert) alert.textContent = status === "timedOut" ? T("Time expired. Your saved answers were submitted automatically.", "考试时间已到，已保存的答案已自动提交。") : T("Exam results", "考试结果");
  }

  /* ============================ EXAM UI ============================ */
  function stopTimer() { if (examUI.timer) { clearInterval(examUI.timer); examUI.timer = null; } }
  function startTimer() {
    stopTimer();
    examUI.timer = setInterval(function () {
      var store = readExamStore();
      if (!store || store === "invalid" || !store.active || examUI.view !== "session") { stopTimer(); return; }
      var a = store.active;
      var nowRaw = Date.now();
      if (nowRaw < a.lastObservedAtMs - 60000 && !a.timingAnomaly) {
        mutateActive(function (x) { x.timingAnomaly = true; });
      }
      var rem = remainingSec(a);
      var el = $("examTimer");
      if (el) { el.textContent = fmtClock(rem); el.classList.toggle("low", rem <= 300); }
      var nowMs = Date.now();
      if (rem <= 300 && rem > 0 && !a.warning5MinShown) {
        var okSave = mutateActive(function (x) { x.warning5MinShown = true; x.lastObservedAtMs = Math.max(x.lastObservedAtMs, nowRaw); });
        if (okSave) { var al = $("examAlert"); if (al) al.textContent = T("5 minutes remaining.", "还剩 5 分钟。"); }
      } else if (nowMs - examUI.lastTickPersist > 15000) {
        examUI.lastTickPersist = nowMs;
        mutateActive(function (x) { x.lastObservedAtMs = Math.max(x.lastObservedAtMs, nowRaw); });
      }
      if (rem <= 0) { finalizeExam("timedOut"); }
    }, 500);
  }

  function designationOf(rec) {
    var kind = rec && rec.assessmentKind;
    if (kind === "curriculum-practice") return T("Curriculum practice", "课程练习");
    return T("SOL practice", "SOL 练习");
  }
  function summaryNotices(profile, info) {
    var out = [];
    if (profile.assessmentKind === "curriculum-practice") out.push(T("Curriculum practice—not a standalone SOL simulation for this grade.", "课程练习，并非该年级独立 SOL 考试的模拟。"));
    if (info.Q < EXAM_CFG.maxQuestions) out.push(T("This bank supports a shorter practice exam, not a full-length SOL simulation.", "当前题库仅支持较短的练习，非完整长度的 SOL 模拟考试。"));
    if (profile.id === "science.g8") out.push(T("This practice uses the site’s Grade 8 Science content and does not guarantee complete assessment coverage.", "本练习使用本站八年级科学内容，不保证涵盖考试的全部范围。"));
    out.push(T("Site-bank practice, not an officially weighted assessment.", "本练习基于本站题库，并非按官方考试权重编制。"));
    if (info.N < 2 * info.Q) out.push(T("This bank has limited question variety; questions may repeat across attempts.", "当前题库题目种类有限，多次练习可能出现重复题目。"));
    out.push(T("These are site practice limits, not official SOL timing or question counts.", "以上为本站练习的时长和题量，并非官方 SOL 考试的时长或题量。"));
    return out;
  }

  function renderExam(errMsg) {
    var host = $("examHost"); if (!host) return;
    var store = readExamStore();
    $("examH").textContent = T("SOL practice exam", "SOL 模拟考试");
    if (store === "invalid") {
      stopTimer();
      $("examSub").textContent = T("Choose a subject and grade or course for practice using this site’s question bank.", "选择科目和年级或课程，使用本站题库进行练习。");
      host.innerHTML = "<p>" + esc(T("Saved exam data cannot be read safely. Export a backup before attempting recovery.", "无法安全读取已保存的考试数据。请先导出备份，再尝试恢复。")) + "</p>" +
        '<div class="pf-actions"><button type="button" class="btn btn-line" id="exRawDl">' + esc(T("Download saved exam data", "下载已保存的模拟考试数据")) + "</button>" +
        '<button type="button" class="btn btn-line" id="exReload">' + esc(T("Reload", "重新加载")) + "</button></div>";
      $("exRawDl").addEventListener("click", function () { var r = LS.getItem(EXAM_KEY); if (r) download("sol-exam-data.json", r); });
      $("exReload").addEventListener("click", function () { location.reload(); });
      return;
    }
    if (examUI.view === "session" && store.active) { renderSession(host, store.active); return; }
    if (examUI.view === "results") {
      var entry = null;
      store.history.forEach(function (h) { if (h.id === examUI.resultsId) entry = h; });
      if (entry) { renderResults(host, entry); return; }
      examUI.view = "landing";
    }
    if (examUI.view === "confirm" && !store.active) { renderConfirm(host, store); return; }
    if (examUI.view === "confirm") examUI.view = "landing";
    stopTimer();
    renderLanding(host, store, errMsg);
  }

  /* Batch H — SOL practice illustrations, same {p, a:[en,zh]} pattern as
     EMPTY_ILL / CELEB_ILL in the main script. Illustration only: injected
     by renderLanding / renderResults; no exam behaviour attached. */
  var SOL_ILL = {
    "intro": { p: "assets/sol-intro.webp", w: 800, h: 600, a: ["Anime-style illustration of a tidy wooden study desk with a closed notebook, a pencil cup, and a small potted plant.", "动漫风格插画：一张整洁的木书桌上放着合上的笔记本、笔筒和一盆小绿植。"] },
    "results": { p: "assets/sol-results.webp", w: 768, h: 768, a: ["Anime-style illustration of a small potted sprout with a green ribbon, beside a neat stack of blank cards on a wooden desk.", "动漫风格插画：一盆系着绿丝带的小嫩芽，放在木桌上，旁边是一叠整齐的空白卡片。"] }
  };
  function solIllHtml(key) {
    var e = SOL_ILL[key]; if (!e) return "";
    return "<figure class='sol-illu'><img src='" + e.p + "' alt='" + esc(T(e.a[0], e.a[1])) + "' width='" + e.w + "' height='" + e.h + "' loading='lazy' role='img'></figure>";
  }

  function renderLanding(host, store, errMsg) {
    $("examSub").textContent = T("Choose a subject and grade or course for practice using this site’s question bank.", "选择科目和年级或课程，使用本站题库进行练习。");
    var bank = buildBank();
    var infos = {};
    EXAM_PROFILES.forEach(function (p) { infos[p.id] = poolInfo(p, bank); });
    var html = "";
    if (errMsg) html += '<p class="pf-err" role="alert">' + esc(errMsg) + "</p>";
    html += "<p>" + esc(T("Real Virginia SOL tests are taken one subject at a time, for one grade or course. This practice works the same way: pick a subject and grade or course, and every question comes from that subject’s lessons on this site. It does not reproduce an official Virginia SOL test blueprint and does not provide an official score or pass prediction.", "弗吉尼亚州真正的 SOL 考试按科目、年级或课程分别进行。本练习采用相同方式：选择科目和年级或课程后，所有题目都来自本站该科目的课程。本练习不采用弗吉尼亚州官方 SOL 考试蓝图，也不提供官方分数或通过预测。")) + "</p>";
    html += "<p>" + esc(T("The timer cannot be paused. It continues if you leave, switch tabs or profiles, close this page, or your device sleeps.", "计时无法暂停。离开页面、切换标签页或学习者、关闭页面，或设备进入睡眠时，计时仍会继续。")) + "</p>";
    html += "<p>" + esc(T("Exam results are stored separately and do not change learning mastery or spaced-repetition schedules.", "模拟考试结果单独保存，不会改变学习掌握度或间隔复习安排。")) + "</p>";
    html += "<p>" + esc(T("Exam data is stored only in this browser on this device. Clearing browser data may erase it.", "模拟考试数据仅保存在此设备的当前浏览器中。清除浏览器数据可能会将其删除。")) + "</p>";

    /* --- active-exam resume panel --- */
    if (store.active) {
      var a = store.active, aTotal = recordTotal(a);
      html += '<div class="exam-summary" role="region" aria-label="' + esc(T("Unfinished exam", "未完成的考试")) + '">';
      html += '<div class="exam-meta"><span class="exam-chip">' + esc(T("In progress", "进行中")) + "</span>" +
        '<span class="exam-chip">' + esc(recordProfileLabel(a)) + "</span>" +
        '<span class="exam-chip">' + esc(designationOf(a)) + "</span>" +
        '<span class="exam-chip">' + esc(F("{answered} of {total} answered", "共 {total} 题，已作答 {answered} 题", { answered: answeredCount(a), total: aTotal })) + "</span>" +
        '<span class="exam-chip">' + esc(F("Time remaining: {time}", "剩余时间：{time}", { time: fmtClock(remainingSec(a)) })) + "</span></div>";
      html += '<div class="pf-actions"><button type="button" class="btn btn-green" id="exResume">' + esc(T("Resume exam", "继续考试")) + "</button>" +
        '<button type="button" class="btn btn-line" id="exAbandonStart">' + esc(T("Abandon and start another", "放弃当前考试并开始新练习")) + "</button></div>";
      html += "<p>" + esc(T("Finish or abandon your unfinished exam before starting another.", "请先完成或放弃尚未结束的模拟考试，再开始新的模拟考试。")) + "</p></div>";
    }

    /* --- two-step picker --- */
    html += '<p class="exam-picker-label" id="exSubjLabel">' + esc(T("Choose a subject", "选择科目")) + "</p>";
    html += '<div class="pf-actions" role="group" aria-labelledby="exSubjLabel" style="margin-top:0">' + PICKER_SUBJECTS.map(function (s) {
      return '<button type="button" class="chip" data-psubj="' + s.key + '" aria-pressed="' + (examUI.selSubject === s.key ? "true" : "false") + '">' + esc(langIdx() ? s.zh : s.en) + "</button>";
    }).join("") + "</div>";
    var gradeKeys = examUI.selSubject === "algebra1" ? ["eoc"] : ["6", "7", "8"];
    if (gradeKeys.indexOf(examUI.selGrade) < 0) examUI.selGrade = gradeKeys[0];
    html += '<p class="exam-picker-label" id="exGradeLabel">' + esc(T("Choose a grade or course", "选择年级或课程")) + "</p>";
    html += '<div class="pf-actions" role="group" aria-labelledby="exGradeLabel" style="margin-top:0">' + gradeKeys.map(function (g) {
      var lbl = g === "eoc" ? T("End-of-course", "课程结业") : (langIdx() ? (g === "6" ? "六年级" : g === "7" ? "七年级" : "八年级") : "Grade " + g);
      return '<button type="button" class="chip" data-pgrade="' + g + '" aria-pressed="' + (examUI.selGrade === g ? "true" : "false") + '">' + esc(lbl) + "</button>";
    }).join("") + "</div>";

    /* --- selected-profile summary + start --- */
    var profile = profileFor(examUI.selSubject, examUI.selGrade);
    html += solIllHtml("intro");
    html += '<div class="exam-summary" id="exSummary">';
    if (!profile || !infos[profile.id] || infos[profile.id].N === 0) {
      html += "<p><b>" + esc(T("Unavailable", "不可用")) + "</b></p>";
      html += '<p class="pf-err" role="alert">' + esc(T("No eligible questions in this bank.", "当前题库没有符合条件的题目。")) + "</p>";
    } else {
      var info = infos[profile.id];
      html += "<p style='font-size:1.1rem'><b>" + esc(profileTitleOf(profile)) + "</b> · " + esc(designationOf(profile)) + "</p>";
      html += "<p><b>" + esc(F("{Q}-question practice · {minutes} minutes", "{Q} 题练习 · {minutes} 分钟", { Q: info.Q, minutes: info.minutes })) + "</b></p>";
      summaryNotices(profile, info).forEach(function (n) { html += "<p>" + esc(n) + "</p>"; });
      html += "<p>" + esc(T("This practice does not affect mastery or spaced-repetition scheduling.", "本练习不会影响掌握度或间隔重复复习安排。")) + "</p>";
      html += '<div class="pf-actions"><button type="button" class="btn btn-gold" id="exStart"' + (store.active ? " disabled" : "") + ">" + esc(T("Start practice exam", "开始模拟练习")) + "</button></div>";
      if (store.active) html += "<p>" + esc(T("An exam is already in progress. Resume it or abandon it above before starting another.", "已有一场考试正在进行。请先在上方继续该考试或放弃它，再开始新的练习。")) + "</p>";
    }
    html += "</div>";

    /* --- history with subject / profile filters --- */
    html += "<h3 style='margin-top:1.4rem'>" + esc(T("Practice history", "练习记录")) + "</h3>";
    html += "<p>" + esc(T("History contains the latest 20 completed exams across all subjects.", "记录保留所有科目中最近完成的 20 次考试。")) + "</p>";
    if (!store.history.length) {
      html += "<p>" + esc(T("No completed exams yet.", "暂无已完成的考试。")) + "</p>";
    } else {
      var subjFilters = [["all", T("All subjects", "全部科目")]].concat(PICKER_SUBJECTS.map(function (s) { return [s.key, langIdx() ? s.zh : s.en]; }));
      html += '<p class="exam-picker-label" id="exHistSubjLabel">' + esc(T("Subject", "科目")) + "</p>";
      html += '<div class="pf-actions" role="group" aria-labelledby="exHistSubjLabel" style="margin-top:0">' + subjFilters.map(function (p2) {
        return '<button type="button" class="chip" data-hsubj="' + p2[0] + '" aria-pressed="' + (examUI.histSubject === p2[0] ? "true" : "false") + '">' + esc(p2[1]) + "</button>";
      }).join("") + "</div>";
      var profOpts = EXAM_PROFILES.filter(function (p3) { return examUI.histSubject === "all" || p3.subject === examUI.histSubject; });
      html += '<label for="exHistProfile" class="exam-picker-label" style="display:block">' + esc(T("Exam profile", "考试类型")) + "</label>";
      html += '<select class="pf-input" id="exHistProfile" style="max-width:340px"><option value="all">' + esc(T("All subjects", "全部科目")) + "</option>" + profOpts.map(function (p3) {
        return '<option value="' + p3.id + '"' + (examUI.histProfile === p3.id ? " selected" : "") + ">" + esc(profileTitleOf(p3)) + "</option>";
      }).join("") + "</select>";
      var rows = store.history.filter(function (h) {
        if (examUI.histSubject !== "all" && h.subject !== examUI.histSubject) return false;
        if (examUI.histProfile !== "all" && h.profileId !== examUI.histProfile) return false;
        return true;
      });
      if (!rows.length) {
        html += "<p>" + esc(T("No exams match this filter.", "没有符合此筛选条件的考试记录。")) + "</p>";
      } else {
        rows.forEach(function (h) {
          var type = h.status === "submitted" ? T("Submitted", "已提交") : h.status === "timedOut" ? T("Time expired", "时间已到") : T("Abandoned — not scored", "已放弃——未计分");
          var tot = recordTotal(h);
          var score = h.status === "abandoned" ? "" : " · " + esc(F("Correct answers: {correct} / {total}", "答对题数：{correct} / {total}", { correct: h.correctCount, total: tot })) + " · " + h.rawPercent + "% · " + esc(F("{score}/600", "{score}/600", { score: h.scaledEstimate }));
          html += '<div class="exam-hist-row"><span style="flex:1">' + esc(fmtDate(h.finishedAt)) + " — <b>" + esc(recordProfileLabel(h)) + "</b> · " + esc(designationOf(h)) + " — " + esc(type) + score + "</span>" +
            '<button type="button" class="mini-btn" data-hist="' + h.id + '" style="min-height:44px">' + esc(T("View", "查看")) + "</button></div>";
        });
      }
    }
    host.innerHTML = html;

    Array.prototype.forEach.call(host.querySelectorAll("[data-psubj]"), function (b) {
      b.addEventListener("click", function () {
        examUI.selSubject = b.getAttribute("data-psubj");
        if (examUI.selSubject === "algebra1") examUI.selGrade = "eoc";
        else if (examUI.selGrade === "eoc") examUI.selGrade = "6";
        renderExam();
      });
    });
    Array.prototype.forEach.call(host.querySelectorAll("[data-pgrade]"), function (b) {
      b.addEventListener("click", function () { examUI.selGrade = b.getAttribute("data-pgrade"); renderExam(); });
    });
    var st = $("exStart");
    if (st) st.addEventListener("click", function () {
      var p4 = profileFor(examUI.selSubject, examUI.selGrade);
      if (!p4) return;
      examUI.confirmProfile = p4.id;
      examUI.view = "confirm";
      renderExam();
    });
    var rs = $("exResume"); if (rs) rs.addEventListener("click", function () {
      var s2 = readExamStore();
      if (s2 && s2 !== "invalid" && s2.active) {
        if (remainingSec(s2.active) <= 0) { finalizeExam("timedOut"); return; }
        examUI.view = "session"; examUI.sessionId = s2.active.id;
        markShown(s2.active.id, s2.active.selection.orderedQuestionIds[s2.active.currentIndex]);
        renderExam();
      }
    });
    var ab = $("exAbandonStart"); if (ab) ab.addEventListener("click", function () {
      showConfirm(T("Abandon and start another", "放弃当前考试并开始新练习"), T("Abandon this exam? Your answers will not receive a score, and you can then choose a subject and start a new practice exam.", "要放弃当前考试吗？本次作答将不计分，之后您可以选择科目并开始新的模拟练习。"), T("Abandon and start another", "放弃当前考试并开始新练习"), function () {
        var s2 = readExamStore();
        if (s2 && s2 !== "invalid" && s2.active && remainingSec(s2.active) <= 0) finalizeExam("timedOut");
        else finalizeExam("abandoned");
        examUI.view = "landing";
        renderExam();
      }, T("Cancel", "取消"));
    });
    Array.prototype.forEach.call(host.querySelectorAll("[data-hsubj]"), function (b) {
      b.addEventListener("click", function () { examUI.histSubject = b.getAttribute("data-hsubj"); examUI.histProfile = "all"; renderExam(); });
    });
    var hp = $("exHistProfile");
    if (hp) hp.addEventListener("change", function () { examUI.histProfile = hp.value; renderExam(); });
    Array.prototype.forEach.call(host.querySelectorAll("[data-hist]"), function (b) {
      b.addEventListener("click", function () { examUI.view = "results"; examUI.resultsId = b.getAttribute("data-hist"); renderExam(); window.scrollTo({ top: host.getBoundingClientRect().top + window.scrollY - 90, behavior: "smooth" }); });
    });
  }

  function renderConfirm(host, store) {
    var profile = profileById(examUI.confirmProfile);
    if (!profile) { examUI.view = "landing"; renderLanding(host, store); return; }
    var info = poolInfo(profile, buildBank());
    $("examSub").textContent = profileTitleOf(profile) + " · " + F("{Q}-question practice · {minutes} minutes", "{Q} 题练习 · {minutes} 分钟", { Q: info.Q, minutes: info.minutes });
    if (!info.N) { examUI.view = "landing"; renderExam(T("No eligible questions in this bank.", "当前题库没有符合条件的题目。")); return; }
    var html = "<h3>" + esc(T("Confirm practice exam", "确认模拟练习")) + "</h3>";
    html += "<p style='font-size:1.1rem'><b>" + esc(profileTitleOf(profile)) + "</b> · " + esc(designationOf(profile)) + "</p>";
    html += "<p><b>" + esc(F("{Q}-question practice · {minutes} minutes", "{Q} 题练习 · {minutes} 分钟", { Q: info.Q, minutes: info.minutes })) + "</b></p>";
    summaryNotices(profile, info).forEach(function (n) { html += "<p>" + esc(n) + "</p>"; });
    html += "<p>" + esc(T("The timer continues when you leave or refresh.", "离开页面或刷新后，计时仍会继续。")) + "</p>";
    html += "<p>" + esc(T("This practice does not affect mastery or spaced-repetition scheduling.", "本练习不会影响掌握度或间隔重复复习安排。")) + "</p>";
    html += "<p>" + esc(T("Linear practice estimate only—not an official SOL score. This practice does not predict SOL proficiency or passing status.", "仅为线性换算的练习估分，并非官方 SOL 成绩，不能用于预测 SOL 达标或通过情况。")) + "</p>";
    html += '<div class="pf-actions"><button type="button" class="btn btn-line" id="exConfirmBack">' + esc(T("Back", "返回")) + "</button>" +
      '<button type="button" class="btn btn-gold" id="exConfirmStart">' + esc(T("Start practice exam", "开始模拟练习")) + "</button></div>";
    host.innerHTML = html;
    $("exConfirmBack").addEventListener("click", function () { examUI.view = "landing"; renderExam(); });
    $("exConfirmStart").addEventListener("click", function () { this.disabled = true; startExam(profile); });
  }

  function showConfirm(title, body, confirmLabel, onConfirm, cancelLabel) {
    var d = makeDialog("<h3>" + esc(title) + "</h3><p>" + esc(body) + "</p>");
    var row = document.createElement("div"); row.className = "pf-actions";
    var ok = document.createElement("button"); ok.type = "button"; ok.className = "btn btn-green"; ok.textContent = confirmLabel;
    var no = document.createElement("button"); no.type = "button"; no.className = "btn btn-line"; no.textContent = cancelLabel || T("Keep reviewing", "继续检查");
    row.appendChild(no); row.appendChild(ok); d.appendChild(row);
    no.addEventListener("click", function () { d.close(); });
    ok.addEventListener("click", function () { ok.disabled = true; d.close(); onConfirm(); });
    d.showModal(); no.focus();
  }

  function renderSession(host, a) {
    if (remainingSec(a) <= 0) { finalizeExam("timedOut"); return; }
    var li = langIdx();
    var total = recordTotal(a);
    var idx = a.currentIndex;
    var qid = a.selection.orderedQuestionIds[idx];
    var q = null;
    a.questions.forEach(function (x) { if (x.questionId === qid) q = x; });
    if (!q) { examUI.view = "landing"; renderExam(); return; }
    $("examSub").textContent = recordProfileLabel(a) + " · " + designationOf(a);
    var answered = answeredCount(a);
    var flagged = a.flaggedQuestionIds.indexOf(qid) >= 0;
    var resp = a.responses[qid];
    if (a.screen === "review") { renderReview(host, a); startTimer(); return; }
    // Display order is attempt-specific; saved responses and answers stay canonical.
    var opts = vaChoiceOrder(q.options.length, a.choiceSeed, q.questionId).map(function (oi) {
      var o = q.options[oi];
      var sel = resp === oi;
      return '<button type="button" class="opt" data-opt="' + oi + '" aria-pressed="' + (sel ? "true" : "false") + '"' + (sel ? ' style="border-color:var(--good);background:var(--good-bg)"' : "") + ">" + esc(o[li] || o[0]) + "</button>";
    }).join("");
    host.innerHTML =
      '<div class="exam-meta"><span class="exam-timer" id="examTimer">' + fmtClock(remainingSec(a)) + "</span>" +
      '<span class="exam-chip">' + esc(F("{answered} of {total} answered", "共 {total} 题，已作答 {answered} 题", { answered: answered, total: total })) + "</span>" +
      '<span class="exam-chip">' + esc(recordProfileLabel(a)) + "</span>" +
      '<span style="flex:1"></span><button type="button" class="mini-btn exam-no-print" id="exLeave" style="min-height:44px">' + esc(T("Leave exam", "离开考试")) + "</button></div>" +
      '<div class="exam-q"><h3 id="examQHead" tabindex="-1">' + esc(F("Question {n} of {total}", "第 {n} 题，共 {total} 题", { n: idx + 1, total: total })) + "</h3>" +
      '<p style="font-weight:700;font-size:1.05rem">' + esc(q.prompt[li] || q.prompt[0]) + '</p><div class="exam-opts">' + opts + "</div></div>" +
      '<div class="pf-actions">' +
      '<button type="button" class="btn btn-line" id="exPrev" ' + (idx === 0 ? "disabled" : "") + ">" + esc(T("Previous", "上一题")) + "</button>" +
      '<button type="button" class="btn btn-line" id="exNext" ' + (idx === total - 1 ? "disabled" : "") + ">" + esc(T("Next", "下一题")) + "</button></div>" +
      '<div class="pf-actions exam-act-sub">' +
      '<button type="button" class="btn btn-line exam-mini-btn" id="exClear" ' + (answeredOf(resp) ? "" : "disabled") + ">" + esc(T("Clear answer", "清除答案")) + "</button>" +
      '<button type="button" class="btn btn-line exam-mini-btn" id="exFlag" aria-pressed="' + (flagged ? "true" : "false") + '">' + esc(flagged ? T("Remove flag", "取消标记") : T("Flag for review", "标记以便检查")) + "</button></div>" +
      '<div class="pf-actions">' +
      '<button type="button" class="btn btn-green" id="exReview">' + esc(T("Review answers", "检查答案")) + "</button></div>" +
      '<div class="exam-navgrid" role="navigation" aria-label="' + esc(T("Question navigation", "题目导航")) + '">' +
      a.selection.orderedQuestionIds.map(function (qq, i) {
        var qqObj = null; a.questions.forEach(function (x) { if (x.questionId === qq) qqObj = x; });
        var isAns = answeredOf(a.responses[qq]); var isFl = a.flaggedQuestionIds.indexOf(qq) >= 0;
        var label = F("Question {n}, {subject}, {answerStatus}, {flagStatus}", "第 {n} 题，{subject}，{answerStatus}，{flagStatus}", { n: i + 1, subject: recordProfileLabel(a), answerStatus: isAns ? T("Answered", "已作答") : T("Unanswered", "未作答"), flagStatus: isFl ? T("Flagged", "已标记") : T("Not flagged", "未标记") });
        return '<button type="button" class="exam-navbtn' + (isAns ? " answered" : "") + (i === idx ? " cur" : "") + '" data-nav="' + i + '" aria-label="' + esc(label) + '"' + (i === idx ? ' aria-current="step"' : "") + ">" + (i + 1) + (isFl ? '<span class="flg" aria-hidden="true">⚑</span>' : "") + "</button>";
      }).join("") + "</div>";
    startTimer();
    Array.prototype.forEach.call(host.querySelectorAll("[data-opt]"), function (b) {
      b.addEventListener("click", function () {
        var oi = parseInt(b.getAttribute("data-opt"), 10);
        var out = mutateActive(function (x) { if (remainingSec(x) <= 0) return false; x.responses[qid] = oi; x.lastObservedAtMs = Math.max(x.lastObservedAtMs, Date.now()); });
        if (!out) { var s2 = readExamStore(); if (s2 && s2 !== "invalid" && s2.active && remainingSec(s2.active) <= 0) finalizeExam("timedOut"); return; }
        renderExam();
      });
    });
    $("exClear").addEventListener("click", function () { mutateActive(function (x) { x.responses[qid] = null; }); renderExam(); });
    $("exFlag").addEventListener("click", function () {
      mutateActive(function (x) { var i = x.flaggedQuestionIds.indexOf(qid); if (i >= 0) x.flaggedQuestionIds.splice(i, 1); else x.flaggedQuestionIds.push(qid); });
      renderExam();
    });
    function goTo(n) {
      var out = mutateActive(function (x) { x.currentIndex = n; x.screen = "question"; x.lastObservedAtMs = Math.max(x.lastObservedAtMs, Date.now()); });
      if (out) { markShown(out.id, out.selection.orderedQuestionIds[n]); renderExam(); var h = $("examQHead"); if (h) h.focus(); }
    }
    if (idx > 0) $("exPrev").addEventListener("click", function () { goTo(idx - 1); });
    if (idx < total - 1) $("exNext").addEventListener("click", function () { goTo(idx + 1); });
    Array.prototype.forEach.call(host.querySelectorAll("[data-nav]"), function (b) {
      b.addEventListener("click", function () { goTo(parseInt(b.getAttribute("data-nav"), 10)); });
    });
    $("exReview").addEventListener("click", function () { mutateActive(function (x) { x.screen = "review"; }); renderExam(); });
    $("exLeave").addEventListener("click", function () {
      showConfirm(T("Leave exam?", "离开考试？"), T("Leave this exam? Your saved answers remain, but the timer will continue.", "要离开考试吗？已保存的答案会保留，但计时仍会继续。"), T("Leave exam", "离开考试"), function () {
        mutateActive(function (x) { x.lastObservedAtMs = Math.max(x.lastObservedAtMs, Date.now()); x.screen = "question"; });
        stopTimer(); examUI.view = "landing"; renderExam();
      });
    });
  }

  function renderReview(host, a) {
    var total = recordTotal(a);
    var f = examUI.filter;
    var ans = answeredCount(a), un = total - ans, fl = a.flaggedQuestionIds.length;
    var items = a.selection.orderedQuestionIds.map(function (qid, i) { return { qid: qid, i: i }; }).filter(function (it) {
      if (f === "unanswered") return !answeredOf(a.responses[it.qid]);
      if (f === "flagged") return a.flaggedQuestionIds.indexOf(it.qid) >= 0;
      return true;
    });
    host.innerHTML =
      '<div class="exam-meta"><span class="exam-timer" id="examTimer">' + fmtClock(remainingSec(a)) + "</span>" +
      '<span class="exam-chip">' + esc(recordProfileLabel(a)) + "</span>" +
      '<span class="exam-chip">' + esc(F("{answered} answered · {unanswered} unanswered · {flagged} flagged", "已作答 {answered} 题 · 未作答 {unanswered} 题 · 已标记 {flagged} 题", { answered: ans, unanswered: un, flagged: fl })) + "</span></div>" +
      "<h3>" + esc(T("Review answers", "检查答案")) + "</h3>" +
      '<div class="pf-actions" role="group" aria-label="' + esc(T("Filter questions", "筛选题目")) + '">' +
      [["all", T("All", "全部")], ["unanswered", T("Unanswered", "未作答")], ["flagged", T("Flagged", "已标记")]].map(function (p) {
        return '<button type="button" class="chip" data-filter="' + p[0] + '" aria-pressed="' + (f === p[0] ? "true" : "false") + '">' + esc(p[1]) + "</button>";
      }).join("") + "</div>" +
      (items.length ? '<div class="exam-navgrid">' + items.map(function (it) {
        var isAns = answeredOf(a.responses[it.qid]); var isFl = a.flaggedQuestionIds.indexOf(it.qid) >= 0;
        var qo = null; a.questions.forEach(function (x) { if (x.questionId === it.qid) qo = x; });
        var label = F("Question {n}, {subject}, {answerStatus}, {flagStatus}", "第 {n} 题，{subject}，{answerStatus}，{flagStatus}", { n: it.i + 1, subject: recordProfileLabel(a), answerStatus: isAns ? T("Answered", "已作答") : T("Unanswered", "未作答"), flagStatus: isFl ? T("Flagged", "已标记") : T("Not flagged", "未标记") });
        return '<button type="button" class="exam-navbtn' + (isAns ? " answered" : "") + '" data-nav="' + it.i + '" aria-label="' + esc(label) + '">' + (it.i + 1) + (isFl ? '<span class="flg" aria-hidden="true">⚑</span>' : "") + "</button>";
      }).join("") + "</div>" : "<p>" + esc(T("No questions match this filter.", "没有符合此筛选条件的题目。")) + "</p>") +
      '<div class="pf-actions"><button type="button" class="btn btn-line" id="exBackQ">' + esc(T("Return to current question", "返回当前题目")) + "</button>" +
      '<button type="button" class="btn btn-gold" id="exSubmit">' + esc(T("Submit exam", "提交考试")) + "</button></div>";
    Array.prototype.forEach.call(host.querySelectorAll("[data-filter]"), function (b) {
      b.addEventListener("click", function () { examUI.filter = b.getAttribute("data-filter"); renderExam(); });
    });
    Array.prototype.forEach.call(host.querySelectorAll("[data-nav]"), function (b) {
      b.addEventListener("click", function () {
        var n = parseInt(b.getAttribute("data-nav"), 10);
        var out = mutateActive(function (x) { x.currentIndex = n; x.screen = "question"; });
        if (out) { markShown(out.id, out.selection.orderedQuestionIds[n]); renderExam(); var h = $("examQHead"); if (h) h.focus(); }
      });
    });
    $("exBackQ").addEventListener("click", function () { mutateActive(function (x) { x.screen = "question"; }); renderExam(); });
    $("exSubmit").addEventListener("click", function () {
      var s2 = readExamStore(); if (!s2 || s2 === "invalid" || !s2.active) return;
      var un2 = recordTotal(s2.active) - answeredCount(s2.active);
      showConfirm(T("Submit exam?", "提交考试？"),
        F("Submit this exam? {count} questions are unanswered. Unanswered questions count as incorrect. You cannot change answers after submission.", "要提交考试吗？还有 {count} 道题未作答。未作答题目按错误计分。提交后无法修改答案。", { count: un2 }),
        T("Submit exam", "提交考试"), function () { finalizeExam("submitted"); });
    });
  }

  function renderResults(host, entry) {
    stopTimer();
    var li = langIdx();
    var total = recordTotal(entry);
    $("examSub").textContent = recordProfileLabel(entry) + " · " + designationOf(entry);
    var html = "<h3>" + esc(T("Exam results", "考试结果")) + "</h3>";
    html += '<p class="exam-chip" style="display:inline-block">' + esc(T("Saved on this device", "已保存在此设备上")) + "</p>";
    html += "<p style='font-size:1.15rem'><b>" + esc(recordProfileLabel(entry)) + "</b> · " + esc(designationOf(entry)) + "</p>";
    var type = entry.status === "submitted" ? T("Submitted", "已提交") : entry.status === "timedOut" ? T("Time expired", "时间已到") : T("Abandoned — not scored", "已放弃——未计分");
    html += "<p><b>" + esc(T("Completion status", "完成状态")) + ":</b> " + esc(type) + " · <b>" + esc(T("Completion date", "完成日期")) + ":</b> " + esc(fmtDate(entry.finishedAt)) + "</p>";
    html += "<p><b>" + esc(T("Elapsed time", "已用时间")) + ":</b> " + esc(fmtElapsed(entry.elapsedSec)) + "</p>";
    if (entry.timingAnomaly) html += '<p class="pf-err">' + esc(T("A device-clock change was detected. Timing may be unreliable.", "检测到设备时钟变化，计时可能不准确。")) + "</p>";
    html += "<p>" + esc(T("Timing uses this device’s clock and is not tamper-proof or proctored.", "计时依赖此设备的时钟，不具备防篡改或监考功能。")) + "</p>";
    if (entry.status !== "abandoned") {
      html += '<p style="font-family:var(--serif);font-size:2rem;font-weight:700;margin:.4rem 0">' + esc(F("Correct answers: {correct} / {total}", "答对题数：{correct} / {total}", { correct: entry.correctCount, total: total })) + "</p>";
      html += "<p><b>" + esc(T("Percentage", "正确率")) + ":</b> " + entry.rawPercent + "%</p>";
      html += "<p><b>" + esc(T("Linear practice estimate", "线性换算练习估分")) + ":</b> " + esc(F("{score}/600", "{score}/600", { score: entry.scaledEstimate })) + "</p>";
      html += "<p>" + esc(T("Linear practice estimate only—not an official SOL score. This practice does not predict SOL proficiency or passing status.", "仅为线性换算的练习估分，并非官方 SOL 成绩，不能用于预测 SOL 达标或通过情况。")) + "</p>";
      html += "<p>" + esc(F("{count} questions flagged", "已标记 {count} 道题", { count: entry.flaggedQuestionIds.length })) + "</p>";
      /* question-by-question review via current bank + fingerprint match */
      var bank = buildBank(); var byId = {};
      bank.forEach(function (b) { byId[b.questionId] = b; });
      html += solIllHtml("results");
      html += "<h4>" + esc(T("Question-by-question review", "逐题回顾")) + "</h4>";
      entry.questionResults.forEach(function (r, i) {
        var b = byId[r.questionId];
        html += '<div class="exam-review-q"><p style="margin:0 0 .3rem"><span class="st ' + (r.correct ? "ok" : "no") + '">' + (i + 1) + ". " + esc(recordProfileLabel(entry)) + " — " + esc(r.correct ? T("Correct", "正确") : (r.response === null ? T("No answer", "未作答") : T("Incorrect", "错误"))) + "</span>" + (entry.flaggedQuestionIds.indexOf(r.questionId) >= 0 ? ' <span aria-hidden="true">⚑</span>' : "") + "</p>";
        if (!b || b.fingerprint !== r.fingerprint) {
          html += "<p>" + esc(T("Stored question content or assets cannot be displayed; detailed review is unavailable. The stored score is unchanged.", "无法显示已保存的题目内容或资源，暂不能查看详细解析。已保存的分数不受影响。")) + "</p>";
        } else {
          var qq = b.question;
          html += "<p style='font-weight:700'>" + esc(qq[0][li] || qq[0][0]) + "</p>";
          html += "<p><b>" + esc(T("Your answer", "你的答案")) + ":</b> " + (r.response === null ? esc(T("No answer", "未作答")) : esc(qq[1][r.response][li] || qq[1][r.response][0])) + "</p>";
          html += "<p><b>" + esc(T("Correct answer", "正确答案")) + ":</b> " + esc(qq[1][qq[2]][li] || qq[1][qq[2]][0]) + "</p>";
          html += "<p><b>" + esc(T("Explanation", "解析")) + ":</b> " + esc(qq[3][li] || qq[3][0]) + "</p>";
        }
        html += "</div>";
      });
    }
    html += '<div class="pf-actions exam-no-print"><button type="button" class="btn btn-line" id="exDlResult">' + esc(T("Download result", "下载成绩")) + "</button>" +
      '<button type="button" class="btn btn-green" id="exBack">' + esc(T("Back to exams", "返回模拟考试")) + "</button></div>";
    host.innerHTML = html;
    $("exDlResult").addEventListener("click", function () {
      var payload = { format: "va-sol-practice-result", version: 2, persisted: true, entry: entry, disclaimer: T("Linear practice estimate only—not an official SOL score. This practice does not predict SOL proficiency or passing status.", "仅为线性换算的练习估分，并非官方 SOL 成绩，不能用于预测 SOL 达标或通过情况。") };
      download("sol-practice-result_" + entry.id.slice(0, 8) + ".json", JSON.stringify(payload, null, 2));
    });
    $("exBack").addEventListener("click", function () { examUI.view = "landing"; renderExam(); });
  }

  /* ==================== EXAM SECTION IN PARENT REPORT ==================== */
  function renderExamReport() {
    var host = $("examReportHost"); if (!host) return;
    var store = readExamStore();
    var html = "<h4 style='font-family:var(--serif);font-size:1.08rem;margin:0 0 .55rem'>" + esc(T("SOL practice exams — separate practice evidence", "SOL 模拟考试——独立练习记录")) + "</h4>";
    if (store === "invalid") {
      host.innerHTML = html + "<p>" + esc(T("SOL practice exam records could not be read. Other report sections are unaffected.", "无法读取 SOL 模拟考试记录，报告的其他部分不受影响。")) + "</p>";
      return;
    }
    var reg = VP.readReg();
    var name = (reg && reg !== "invalid") ? activeProfile(reg).displayName : T("This device’s learner", "此设备的学习者");
    html += "<p><b>" + esc(F("Learner: {name}", "学习者：{name}", { name: name })) + "</b></p>";
    var scored = store.history.filter(function (h) { return h.status === "submitted" || h.status === "timedOut"; });
    if (!scored.length) {
      html += "<p>" + esc(T("No scored SOL practice exams yet.", "暂无已计分的 SOL 模拟考试。")) + "</p>";
    } else {
      /* Group strictly by exact profile — never one combined
         cross-subject SOL score. */
      var groups = {}, order = [];
      scored.forEach(function (h) {
        if (!h.profileId) return;
        var key = h.profileId;
        if (!groups[key]) { groups[key] = []; order.push(key); }
        groups[key].push(h);
      });
      order.forEach(function (key) {
        var list = groups[key].slice().sort(function (x, y) { return x.finishedAt < y.finishedAt ? -1 : x.finishedAt > y.finishedAt ? 1 : (x.id < y.id ? -1 : 1); });
        var latest = list[list.length - 1];
        var versions = {};
        list.forEach(function (h) { versions[String(h.profileVersion)] = true; });
        html += "<h5 style='margin:.9rem 0 .3rem;font-size:1rem'>" + esc(recordProfileLabel(latest)) + " · " + esc(designationOf(latest)) + "</h5>";
        html += "<p>" + esc(F("Attempts", "练习次数")) + ": " + list.length + " · " + esc(T("Latest result", "最近成绩")) + ": " +
          esc(F("Correct answers: {correct} / {total}", "答对题数：{correct} / {total}", { correct: latest.correctCount, total: recordTotal(latest) })) + " · " + latest.rawPercent + "% (" + esc(fmtDate(latest.finishedAt)) + ")</p>";
        html += "<p>" + esc(T("Percentage trend", "正确率趋势")) + ": " + list.map(function (h) { return h.rawPercent + "%"; }).join(" → ") + "</p>";
        if (Object.keys(versions).length > 1) html += '<p class="pf-err">' + esc(T("Profile scope or version changed; results may not be directly comparable.", "考试范围或版本已变更，成绩可能无法直接比较。")) + "</p>";
        html += '<div class="exam-table-scroll" role="region" tabindex="0" aria-label="' + esc(T("Exam result history — scroll horizontally to see all columns", "考试成绩记录——左右滚动查看所有列")) + '"><table class="exam-table"><thead><tr><th>' + esc(T("Completion date", "完成日期")) + "</th><th>" + esc(T("Completion status", "完成状态")) + "</th><th>" + esc(T("Correct / total", "答对题数／总题数")) + "</th><th>" + esc(T("Percentage", "正确率")) + "</th><th>" + esc(T("Linear practice estimate", "线性换算练习估分")) + "</th></tr></thead><tbody>";
        list.slice().reverse().slice(0, 5).forEach(function (h) {
          html += "<tr><td>" + esc(fmtDate(h.finishedAt)) + (h.timingAnomaly ? " ⚠" : "") + "</td><td>" + esc(h.status === "submitted" ? T("Submitted", "已提交") : T("Time expired", "时间已到")) + "</td><td>" + h.correctCount + " / " + recordTotal(h) + "</td><td>" + h.rawPercent + "%</td><td>" + esc(F("{score}/600", "{score}/600", { score: h.scaledEstimate })) + "</td></tr>";
        });
        html += "</tbody></table></div>";
      });
    }
    html += "<p>" + esc(T("Linear practice estimate only—not an official SOL score. This practice does not predict SOL proficiency or passing status.", "仅为线性换算的练习估分，并非官方 SOL 成绩，不能用于预测 SOL 达标或通过情况。")) + "</p>";
    html += "<p>" + esc(T("History contains the latest 20 completed exams across all subjects.", "记录保留所有科目中最近完成的 20 次考试。")) + "</p>";
    html += "<p>" + esc(T("Exam results do not affect mastery, assessment requirements, or flashcard scheduling.", "考试结果不影响掌握度、评估次数要求或闪卡复习安排。")) + "</p>";
    host.innerHTML = html;
  }


  /* ============================ INIT ============================ */
  function renderAll() { renderSwitcher(); renderManager(); renderExam(); renderExamReport(); }
  function init() {
    /* The menu's Learners link gets the same close-menu-then-navigate
       treatment as the switcher popover's Manage learners link (see
       goToLearners): without it, the menu's saved-scroll restore on
       close can undo the anchor jump to #learners. */
    var nl = $("navLearners");
    if (nl) nl.addEventListener("click", goToLearners);
    var mode = VP.boot.mode;
    if (mode === "recovery" || mode === "migration" || mode === "firstrun") {
      showGate(mode);
      var sw = $("pfSwitch"); if (sw) sw.disabled = true;
      var host = $("examHost"); if (host) host.innerHTML = "<p>" + esc(T("Finish setting up learner profiles above to use the SOL practice exam.", "请先在上方完成学习者资料设置，再使用 SOL 模拟考试。")) + "</p>";
      return;
    }
    recoverProfiles();
    var sw2 = $("pfSwitch");
    if (sw2) sw2.addEventListener("click", function () { if ($("pfPop")) closeSwitcher(); else openSwitcher(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && $("pfPop")) closeSwitcher(); });
    window.addEventListener("storage", function (e) {
      if (e.key === REG) { var r = VP.readReg(); if (r && r !== "invalid" && r.activeProfileId !== VP.boot.activeId) location.reload(); }
      if (e.key === EXAM_KEY && examUI.view !== "session") renderExam();
    });
    window.addEventListener("pageshow", function () {
      var r = VP.readReg();
      if (r && r !== "invalid" && r.activeProfileId !== VP.boot.activeId) { location.reload(); return; }
      var store = readExamStore();
      if (store && store !== "invalid" && store.active && remainingSec(store.active) <= 0 && examUI.view === "session") finalizeExam("timedOut");
    });
    /* Re-render bilingual UI after the site's language toggle changes vaLang.v1 */
    ["langEn", "langZh", "langBi"].forEach(function (id) {
      var b = $(id); if (b) b.addEventListener("click", function () { setTimeout(function () { renderAll(); }, 150); });
    });
    renderAll();
    /* If an active exam already expired while away, finalize on return to the exam view */
    var store = readExamStore();
    if (store && store !== "invalid" && store.active) {
      var a = store.active;
      var hash = location.hash || "";
      if (hash === "#soleexam" && remainingSec(a) <= 0) finalizeExam("timedOut");
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
