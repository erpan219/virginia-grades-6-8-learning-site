/* =====================================================================
   FX89 — F08 Evidence-Based Writing Studio + F09 Source Detective
   Built from batch3-plan.md. Rules honored: NEW localStorage keys only
   (va-ll:f08:v1:profile:<id> and va-ll:f09:v1:profile:<id>, exactly as
   the plan specifies); existing progress, FSRS/SRS, exam and Today's
   Path state are read, never rewritten. Every new string exists in
   English and Simplified Chinese. Workbook theme tokens only.
   Learner writing is never translated or overwritten on language change.
   ===================================================================== */
(function(){
"use strict";
if (typeof LESSONS === "undefined" || !document.body) return;
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function L(){ return (typeof lang !== "undefined") ? lang : "en"; }
function isZh(){ return L() === "zh"; }
function isBi(){ return L() === "bi"; }
function T(pair){ if (!pair) return ""; if (isZh()) return pair[1] || pair[0] || ""; if (isBi()) return (pair[0] || "") + " · " + (pair[1] || ""); return pair[0] || ""; }
function H(pair){ if (!pair) return ""; if (isBi()) return esc(pair[0] || "") + "<span class='bi-sub'>" + esc(pair[1] || "") + "</span>"; return esc(isZh() ? (pair[1] || pair[0] || "") : (pair[0] || "")); }
function fill(tpl, map){ return String(tpl).replace(/\{(\w+)\}/g, function(m, k){ return (map && map[k] != null) ? map[k] : m; }); }
function learnerId(){
  try {
    var reg = (window.VAProfiles && typeof VAProfiles.readReg === "function") ? VAProfiles.readReg() : null;
    if (reg && typeof reg === "object" && reg.activeProfileId) return reg.activeProfileId;
  } catch(e){}
  try { if (window.__vaBoot && window.__vaBoot.activeId) return window.__vaBoot.activeId; } catch(e){}
  return "default";
}
function learnerName(){
  try {
    var reg = (window.VAProfiles && typeof VAProfiles.readReg === "function") ? VAProfiles.readReg() : null;
    if (reg && typeof reg === "object"){ for (var i = 0; i < reg.profiles.length; i++) if (reg.profiles[i].id === reg.activeProfileId) return reg.profiles[i].displayName || ""; }
  } catch(e){}
  return "";
}
function debounce(fn, ms){ var t = null; return function(){ var a = arguments, c = this; if (t) clearTimeout(t); t = setTimeout(function(){ fn.apply(c, a); }, ms); }; }
function nowIso(){ return new Date().toISOString(); }

/* ---------------- styles (workbook tokens only) ---------------- */
var css = document.createElement("style");
css.textContent = [
".w89-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-lg);padding:1.1rem 1.2rem;margin:0 0 1rem}",
".w89-card h3{margin:0 0 .4rem;font-size:1.12rem}",
".w89-sub{color:var(--ink-soft);margin:.2rem 0 .8rem}",
".w89-row{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}",
".w89-note{font-size:.9rem;color:var(--ink-soft)}",
".w89-status{font-size:.85rem;font-weight:700;border-radius:999px;padding:.15rem .6rem;background:var(--card-2);color:var(--ink-soft);white-space:nowrap}",
".w89-status.done{background:var(--good-bg);color:var(--good)}",
".w89-status.bad{background:var(--bad-bg);color:var(--bad)}",
".w89-ta{width:100%;min-height:6.5rem;padding:.7rem .9rem;font-size:1rem;border:1px solid var(--boundary);border-radius:var(--r-sm);background:var(--card);color:var(--ink);font-family:inherit;line-height:1.6}",
".w89-ta[readonly]{background:var(--card-2)}",
".w89-input{width:100%;padding:.65rem .8rem;font-size:1rem;border:1px solid var(--boundary);border-radius:var(--r-sm);background:var(--card);color:var(--ink);font-family:inherit}",
".w89-count{font-size:.82rem;color:var(--ink-faint);text-align:right;margin:.25rem 0 0}",
".w89-evc{border:1px solid var(--line);border-radius:var(--r-md);padding:.8rem .95rem;margin:.55rem 0;background:var(--card)}",
".w89-evid{display:inline-block;font-weight:800;font-size:.8rem;border:1px solid var(--boundary);border-radius:4px;padding:.05rem .4rem;margin-right:.5rem;color:var(--ink-soft)}",
".w89-opt{display:block;width:100%;text-align:left;margin:.4rem 0;padding:.7rem .9rem;border:1px solid var(--boundary);border-radius:var(--r-md);background:var(--card);color:var(--ink);font-size:1rem;min-height:48px}",
".w89-opt[aria-pressed='true'],.w89-opt[aria-checked='true']{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}",
".w89-opt.right{background:var(--good-bg);border-color:var(--good);color:var(--ink)}",
".w89-opt.wrong{background:var(--bad-bg);border-color:var(--bad);color:var(--ink)}",
".w89-fb{border-radius:var(--r-md);padding:.7rem .9rem;margin:.6rem 0;font-size:.98rem}",
".w89-fb.ok{background:var(--good-bg)}",
".w89-fb.no{background:var(--bad-bg)}",
".w89-sent{border:none;background:none;font:inherit;color:inherit;padding:.1rem .15rem;border-radius:4px;cursor:pointer;text-align:left}",
".w89-sent:hover{background:var(--gold-soft)}",
".w89-sent.sel{background:var(--gold-soft);outline:2px solid var(--accent);outline-offset:1px}",
".w89-draftview{border:1px solid var(--line);border-radius:var(--r-md);padding:.85rem .95rem;background:var(--card);line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere}",
"mark.w89-hl{background:var(--gold-soft);color:inherit;padding:.05rem .1rem;border-radius:3px}",
".w89-check{display:flex;gap:.6rem;align-items:flex-start;padding:.45rem 0}",
".w89-check input{width:1.25rem;height:1.25rem;margin-top:.2rem;flex:none;accent-color:var(--accent)}",
".w89-ex span.w89-ann{display:block;border-left:3px solid var(--accent);padding:.5rem .8rem;margin:.55rem 0;background:var(--card-2);border-radius:0 var(--r-sm) var(--r-sm) 0}",
".w89-anntag{display:inline-block;font-size:.75rem;font-weight:800;letter-spacing:.03em;border:1px solid var(--boundary);border-radius:4px;padding:.05rem .4rem;margin-bottom:.3rem;color:var(--ink-soft)}",
".w89-srcgrid{display:grid;gap:1rem;grid-template-columns:1fr}",
"@media (min-width:820px){.w89-srcgrid.side{grid-template-columns:1fr 1fr}}",
".w89-srcline{display:grid;grid-template-columns:auto minmax(0,1fr);gap:.35rem .6rem;align-items:start;padding:.5rem 0;border-top:1px dashed var(--line)}",
".w89-srcline:first-of-type{border-top:none}",
".w89-srcline>span{min-width:0;line-height:1.6}",
".w89-lineno{font-weight:800;font-size:.82rem;border:1px solid var(--boundary);border-radius:4px;padding:.1rem .4rem;color:var(--ink-soft);margin-top:.15rem}",
".w89-srcline.marked .w89-lineno{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}",
".w89-citebtn{grid-column:2;justify-self:start;border:1px solid var(--boundary);background:var(--card);color:var(--ink);border-radius:999px;padding:.32rem .75rem;font-weight:700;font-size:.85rem;min-height:44px;max-width:100%}",
"@media (max-width:600px){.w89-card{padding:.95rem .85rem}.w89-opt{padding:.65rem .75rem}.w89-citebtn{font-size:.82rem}}",
".w89-grid2{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr));margin-top:1rem}",
".w89-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}",
".w89-lessonlink{border:1px dashed var(--boundary);border-radius:var(--r-md);padding:.8rem .95rem;margin:.8rem 0;background:var(--card-2)}",
"@media print{.w89-noprint{display:none!important}}"
].join("\n");
document.head.appendChild(css);

/* ---------------- F08 strings (batch3-plan, exact) ---------------- */
var W8 = {
  title: ["Writing Studio", "写作工作室"],
  intro: ["Make a claim. Use evidence. Explain how the evidence supports your claim.", "提出观点，使用证据，并解释证据如何支持你的观点。"],
  promptH: ["Writing task", "写作任务"],
  prompt: ["Should the town try one later library evening each week? Use the evidence to explain your view.", "镇上是否应该每周试行一个延长图书馆开放时间的晚上？请使用证据说明你的观点。"],
  evH: ["Evidence tray", "证据栏"],
  evAdd: ["Add to my evidence notes", "加入我的证据笔记"],
  evNoteLabel: ["Evidence I might use", "我可能使用的证据"],
  scaffoldH: ["Plan your response", "规划你的回答"],
  claimL: ["Claim — What do you think?", "观点——你怎么看？"],
  evL: ["Evidence — Which detail supports your claim?", "证据——哪个细节支持你的观点？"],
  reasL: ["Reasoning — Why does that detail matter?", "推理——为什么这个细节重要？"],
  draftH: ["My first draft", "我的初稿"],
  draftPh: ["Write your response here. Your plan and evidence notes stay visible.", "在这里写下你的回答。你的写作计划和证据笔记会一直显示。"],
  draftAction: ["Save first draft and start revising", "保存初稿并开始修改"],
  revH: ["My revision", "我的修改稿"],
  revHint: ["Improve your draft. Your saved first draft will stay unchanged.", "改进你的初稿。已保存的初稿不会改变。"],
  revAction: ["Save revision", "保存修改稿"],
  exShow: ["Show annotated example", "查看带批注的范例"],
  exHide: ["Hide annotated example", "隐藏带批注的范例"],
  exLabel: ["Example, not a required answer", "范例，并非唯一正确答案"],
  checkH: ["Revision checklist", "修改检查清单"],
  compH: ["Compare my writing", "对比我的写作"],
  sentFirst: ["Choose the sentence from your first draft that you improved.", "选择你在初稿中改进的句子。"],
  sentRev: ["Choose its improved sentence in your revision.", "选择修改稿中对应的改进句子。"],
  before: ["Before", "修改前"],
  after: ["After", "修改后"],
  finish: ["Mark writing complete", "标记写作已完成"],
  stNot: ["Not started", "未开始"],
  stPlan: ["Planning", "规划中"],
  stRev: ["Revising", "修改中"],
  stDone: ["Complete", "已完成"],
  saveOk: ["Saved on this device", "已保存在此设备"],
  saving: ["Saving…", "正在保存…"],
  saveFail: ["Could not save on this device", "无法保存在此设备"],
  errNoDraft: ["Write a first draft before starting a revision.", "写出初稿后才能开始修改。"],
  errNoRev: ["Save your revision before comparing sentences.", "保存修改稿后才能对比句子。"],
  errNoSent: ["Choose one sentence from each version.", "请从两个版本中各选一个句子。"],
  errChecklist: ["Finish the checklist before marking this complete.", "完成检查清单后才能标记完成。"],
  tryAgain: ["Try saving again", "重试保存"],
  copy: ["Copy my writing", "复制我的写作"],
  copied: ["Copied.", "已复制。"],
  copyManual: ["Copy the text below:", "请复制下面的文字："],
  newDraft: ["Start a new draft", "开始新的初稿"],
  newConfirm: ["Start over for this task? This removes only this Writing Studio entry. Your lesson progress stays saved.", "要重新开始这个写作任务吗？这只会删除这条写作工作室记录，你的课程进度仍会保留。"],
  confirmYes: ["Yes, start a new draft", "是的，开始新的初稿"],
  cancel: ["Cancel", "取消"],
  conflict: ["This writing changed in another tab. Copy your text or reload before saving.", "另一标签页中的写作已更改。请先复制你的文字，或重新加载后再保存。"],
  reload: ["Reload saved writing", "重新加载已保存的写作"],
  corrupt: ["Saved writing for this task could not be read. It has been kept as-is — copy it or start a new draft.", "无法读取这个任务已保存的写作。原文已原样保留——请复制它，或开始新的初稿。"],
  manual: ["Select a sentence manually", "手动选择句子"],
  useSel: ["Use selected text", "使用所选文字"],
  manualHint: ["Select part of the saved text in the box, then choose “Use selected text”. The selection must match the saved text exactly.", "在框中选择已保存文本的一部分，然后点“使用所选文字”。所选内容必须与已保存文本完全一致。"],
  notExact: ["That selection is not an exact part of the saved text.", "所选内容不是已保存文本的准确部分。"],
  charCount: ["{n} / {max} characters", "{n} / {max} 字符"],
  improvedTag: ["More specific; connects the claim to evidence", "更具体；将观点与证据联系起来"],
  baBefore: ["The library should stay open later.", "图书馆应该晚点关门。"],
  baAfter: ["The town should try one later library evening so families who cannot arrive before closing have another chance to visit.", "镇上应该试行每周有一个晚上延长图书馆开放时间，让无法在闭馆前赶到的家庭多一次到访机会。"],
  continueWriting: ["Continue writing", "继续写作"],
  openStudio: ["Open Writing Studio", "打开写作工作室"],
  lessonLinkNote: ["Build a claim–evidence–reasoning response for this lesson in the Writing Studio.", "在本课的写作工作室中，写一段观点—证据—推理的回答。"],
  savedRevNote: ["Last saved revision is what the comparison uses. Editing clears your sentence picks and completion until you save again.", "对比使用的是最后保存的修改稿。再次编辑会清除句子选择和完成状态，保存后需重新选择。"],
  checklist: [
    ["I stated a clear claim.", "我清楚地提出了观点。"],
    ["I used a specific detail from the evidence tray.", "我使用了证据栏中的具体细节。"],
    ["I explained how that detail supports my claim.", "我解释了该细节如何支持我的观点。"],
    ["I checked whether my writing needs a qualification or unanswered question.", "我检查了写作中是否需要补充限定条件或未解答的问题。"],
    ["I reread my sentences for clarity.", "我重新阅读句子，检查表达是否清楚。"]
  ],
  evidence: [
    { id: "E1", text: ["In a proposed four-week trial, the town library would stay open two hours later on one weekday evening.", "在一项拟议的四周试行计划中，镇图书馆将在每周一个工作日的晚上延长开放两小时。"] },
    { id: "E2", text: ["A resident’s letter says some families cannot visit before the library’s usual closing time.", "一封居民来信说，有些家庭无法在图书馆通常的闭馆时间前到访。"] },
    { id: "E3", text: ["The proposal does not state how much the trial would cost.", "该提案没有说明试行计划需要多少费用。"] }
  ],
  exemplar: [
    { tag: ["Claim", "观点"], text: ["The town should try one later library evening each week.", "镇上应该试行每周有一个晚上延长图书馆开放时间。"] },
    { tag: ["Evidence", "证据"], text: ["A resident’s letter says some families cannot visit before the usual closing time (E2).", "一封居民来信说，有些家庭无法在通常的闭馆时间前到访（E2）。"] },
    { tag: ["Reasoning", "推理"], text: ["A later evening could give those families another chance to use the library; the town should also check the trial’s cost before making the change permanent (E3).", "延长一个晚上的开放时间，可能让这些家庭多一次使用图书馆的机会；在永久改变开放时间前，镇上还应核实试行计划的费用（E3）。"] }
  ]
};

/* ---------------- F09 strings + pair (batch3-plan, exact) ---------------- */
var D9 = {
  title: ["Source Detective", "资料侦探"],
  intro: ["Read both sources. Investigate what each says—and what it does not tell you.", "阅读两份资料。调查每份资料说了什么，以及没有告诉你什么。"],
  notice: ["Practice sources: written for this activity; not real town documents.", "练习资料：专为本活动编写，并非真实的镇政府文件。"],
  srcA: ["Source A", "资料 A"],
  srcB: ["Source B", "资料 B"],
  side: ["View side by side", "并排查看"],
  qAuthor: ["Who wrote it?", "作者是谁？"],
  qPurpose: ["Why was it written?", "写作目的是什么？"],
  qClaim: ["What is its main claim?", "主要观点是什么？"],
  qEvidence: ["Which line supports that claim?", "哪一行支持这个观点？"],
  qLimit: ["What is one limitation?", "有什么局限？"],
  diffPrompt: ["Where do the sources disagree or place different emphasis?", "两份资料在哪一点上有分歧，或侧重点不同？"],
  respPrompt: ["Should the town try one later library evening each week? Cite at least one source and explain why its detail matters to your answer.", "镇上是否应该试行每周有一个晚上延长图书馆开放时间？请引用至少一份资料，并解释其中的细节为什么与你的回答有关。"],
  cite: ["Add line citation", "加入行号引用"],
  respHint: ["Example citation: (Source A, line 2). A citation identifies a source; you still need to explain its importance.", "引用示例：（资料 A，第 2 行）。引用指出资料来源；你还需要解释它的重要性。"],
  saveLater: ["Save for later", "保存，稍后继续"],
  check: ["Check my investigation", "检查我的调查"],
  revise: ["Revise answers", "修改答案"],
  another: ["Try another pair", "尝试另一组资料"],
  onlyPair: ["Only one practice pair is available right now.", "目前只有一组练习资料。"],
  stNot: ["Not started", "未开始"],
  stProg: ["In progress", "进行中"],
  stDone: ["Complete", "已完成"],
  fbCompare: ["Compare your thinking", "对照你的想法"],
  fbPossible: ["Possible interpretations", "可能的解读"],
  fbCite: ["Check the cited line", "检查所引用的行"],
  valAll: ["Answer each source question and describe a difference before checking.", "检查前，请回答每份资料的问题，并描述两者的一个差异。"],
  valCite: ["Add a response with a citation to a selected source line and explain why it matters.", "请写出回答，引用所选资料中的一行，并解释它为什么重要。"],
  saveFail: ["Could not save on this device. Copy your response before leaving.", "无法保存在此设备。离开前请复制你的回答。"],
  citePresent: ["A citation is present. Reread whether your sentence explains why that line supports your answer.", "已添加引用。请重新阅读：你的句子是否解释了这一行为什么支持你的回答？"],
  copyResp: ["Copy my response", "复制我的回答"],
  copied: ["Copied.", "已复制。"],
  copyManual: ["Copy the text below:", "请复制下面的文字："],
  reset: ["Start this pair over", "重新开始这组资料"],
  resetConfirm: ["Start this pair over? This removes only this Source Detective entry.", "要重新开始这组资料吗？这只会删除这条资料侦探记录。"],
  confirmYes: ["Yes, start over", "是的，重新开始"],
  cancel: ["Cancel", "取消"],
  conflict: ["This investigation changed in another tab. Copy your text or reload before saving.", "另一标签页中的调查已更改。请先复制你的文字，或重新加载后再保存。"],
  reload: ["Reload saved investigation", "重新加载已保存的调查"],
  corrupt: ["Saved work for this pair could not be read. It has been kept as-is — copy it or start over.", "无法读取这组资料已保存的记录。原文已原样保留——请复制它，或重新开始。"],
  matchKey: ["Matches the authored reading.", "与编写的解读一致。"],
  diffKey: ["Different from the authored reading — see the possible interpretations below.", "与编写的解读不同——见下方的可能解读。"],
  freeNote: ["Your written difference and response are not graded by the software — compare them with the possible interpretations.", "你写出的差异和回答不会被软件评分——请与可能的解读对照。"],
  diffExample: ["A proposes trying one later evening and reviewing visits; B says the town should also ask families which days they can visit.", "资料 A 提议延长一个晚上的开放时间并查看到访情况；资料 B 认为镇上还应询问各家庭哪些日子方便到访。"],
  charCount: ["{n} / {max} characters", "{n} / {max} 字符"],
  openDetective: ["Open Source Detective", "打开资料侦探"],
  lessonLinkNote: ["Investigate two practice sources about this lesson's topic in Source Detective.", "在资料侦探中，调查与本课主题相关的两份练习资料。"],
  savedNote: ["Saved on this device", "已保存在此设备"],
  authors: [
    { id: "auth-clerk", text: ["Town Council clerk (practice source)", "镇议会文书（练习资料）"] },
    { id: "auth-resident", text: ["A resident (practice source)", "一位居民（练习资料）"] },
    { id: "auth-librarian", text: ["Librarian", "图书馆员"] },
    { id: "auth-reporter", text: ["News reporter", "新闻记者"] }
  ],
  purposes: [
    { id: "pur-propose", text: ["Propose a trial", "提议试行"] },
    { id: "pur-argue", text: ["Argue the trial may not be enough", "说明试行可能不够"] },
    { id: "pur-advertise", text: ["Advertise a book", "宣传一本书"] },
    { id: "pur-report", text: ["Report a completed vote", "报道已完成的投票"] }
  ],
  claims: [
    { id: "claim-trial", text: ["The town should consider a four-week trial and review visits afterward.", "镇上应考虑进行四周试行，之后查看到访情况。"] },
    { id: "claim-ask", text: ["One later evening may help, but the town should ask families which days work.", "延长一个晚上的开放时间可能有帮助，但镇上应询问各家庭哪些日子方便。"] },
    { id: "claim-permanent", text: ["The trial has already become permanent.", "试行计划已经永久实施。"] },
    { id: "claim-close", text: ["The library should close on weekdays.", "图书馆应在工作日关闭。"] }
  ],
  limits: [
    { id: "lim-cost", text: ["It does not state the trial’s cost.", "它没有说明试行计划的费用。"] },
    { id: "lim-oneview", text: ["One writer’s view does not show what all families want.", "一位写信人的看法不能说明所有家庭的想法。"] },
    { id: "lim-survey", text: ["It includes a complete survey of families.", "它包含对所有家庭的完整调查。"] },
    { id: "lim-final", text: ["It reports the final results of the trial.", "它报告了试行计划的最终结果。"] }
  ],
  pair: {
    id: "library-evening-pair-v1",
    A: {
      title: ["Proposed library-hours trial", "拟议的图书馆开放时间试行计划"],
      authorId: "auth-clerk", purposeId: "pur-propose", claimId: "claim-trial", limitId: "lim-cost",
      goodLines: ["A2", "A3"],
      lines: [
        { id: "A1", text: ["The Town Council is considering a four-week trial of later library hours.", "镇议会正在考虑一项为期四周的图书馆延长开放时间试行计划。"] },
        { id: "A2", text: ["During the trial, the library would stay open two hours later on one weekday evening each week.", "试行期间，图书馆每周将在一个工作日的晚上延长开放两小时。"] },
        { id: "A3", text: ["After four weeks, the council would review visits during the later hours before deciding whether to continue.", "四周后，议会将查看延长开放时段的到访情况，再决定是否继续。"] }
      ]
    },
    B: {
      title: ["Letter about library access", "关于使用图书馆的来信"],
      authorId: "auth-resident", purposeId: "pur-argue", claimId: "claim-ask", limitId: "lim-oneview",
      goodLines: ["B2", "B3"],
      lines: [
        { id: "B1", text: ["I welcome the discussion about later library hours.", "我很高兴大家开始讨论图书馆延长开放时间。"] },
        { id: "B2", text: ["Some families cannot reach the library before its usual closing time.", "有些家庭无法在图书馆通常的闭馆时间前赶到。"] },
        { id: "B3", text: ["One later evening might help, but I think the town should also ask families which days they could visit.", "延长一个晚上的开放时间可能有帮助，但我认为镇上还应该询问各家庭哪些日子方便到访。"] }
      ]
    }
  }
};

/* ---------------- storage adapters (new keys only, per plan) ---------------- */
function makeStore(kind){
  var key = "va-ll:" + kind + ":v1:profile:" + encodeURIComponent(learnerId());
  var state = { key: key, doc: null, rawSeen: null, broken: false, brokenRaw: null, saveOk: true, conflict: false };
  function emptyDoc(){ return kind === "f08" ? { version: 1, entries: {} } : { version: 1, pairs: {} }; }
  function load(){
    var raw = null;
    try { raw = window.localStorage.getItem(key); } catch(e){ state.broken = false; state.doc = emptyDoc(); state.rawSeen = null; return state; }
    state.rawSeen = raw;
    if (raw == null){ state.doc = emptyDoc(); state.broken = false; return state; }
    try {
      var v = JSON.parse(raw);
      if (!v || v.version !== 1 || typeof v !== "object") throw new Error("schema");
      if (kind === "f08" && (typeof v.entries !== "object" || !v.entries)) throw new Error("schema");
      if (kind === "f09" && (typeof v.pairs !== "object" || !v.pairs)) throw new Error("schema");
      state.doc = v; state.broken = false; state.brokenRaw = null;
    } catch(e){ state.broken = true; state.brokenRaw = raw; state.doc = emptyDoc(); }
    return state;
  }
  function save(){
    if (state.broken) return false;
    /* cross-tab guard: re-read before writing */
    var cur = null;
    try { cur = window.localStorage.getItem(key); } catch(e){}
    if (cur !== state.rawSeen){
      /* another tab (or profile render) changed it since we loaded;
         only flag a conflict when the on-disk doc actually differs */
      if (cur != null && state.rawSeen != null){ state.conflict = true; return false; }
      state.rawSeen = cur;
    }
    try {
      var payload = JSON.stringify(state.doc);
      window.localStorage.setItem(key, payload);
      state.rawSeen = payload; state.saveOk = true; return true;
    } catch(e){ state.saveOk = false; return false; }
  }
  state.load = load; state.save = save; state.emptyDoc = emptyDoc;
  load();
  return state;
}
var store8 = makeStore("f08");
var store9 = makeStore("f09");
function reloadStores(){ store8 = makeStore("f08"); store9 = makeStore("f09"); }

/* ---------------- scaffolding: sections + nav ---------------- */
function mkSec(id, eyebrowPair, titlePair, subPair, hId){
  var s = document.createElement("section");
  s.className = "block"; s.id = id; s.setAttribute("aria-labelledby", hId);
  s.innerHTML = "<div class='sec-head'><div><p class='eyebrow w89-eyebrow'></p><h2 id='" + hId + "'></h2><p class='w89-sub w89-secsub'></p></div></div><div class='w89-host'></div>";
  s.querySelector(".w89-eyebrow").textContent = T(eyebrowPair);
  s.querySelector("h2").textContent = T(titlePair);
  s.querySelector(".w89-secsub").textContent = T(subPair);
  s._head = { e: eyebrowPair, t: titlePair, s: subPair };
  return s;
}
var anchorSec = $("sessionbuilder") || $("today");
var secW = mkSec("writingstudio", ["Writing · Evidence", "写作 · 证据"], W8.title, W8.intro, "w8H");
var secD = mkSec("sourcedetective", ["Reading · Civic Evidence", "阅读 · 公民证据"], D9.title, D9.intro, "d9H");
if (anchorSec && anchorSec.parentNode){
  anchorSec.parentNode.insertBefore(secW, anchorSec.nextSibling);
  secW.parentNode.insertBefore(secD, secW.nextSibling);
} else if (document.querySelector("main.wrap")){
  document.querySelector("main.wrap").appendChild(secW);
  document.querySelector("main.wrap").appendChild(secD);
}
var navLinks89 = [];
(function(){
  var menu = $("moreMenu");
  function mk(href, pair){
    var a = document.createElement("a"); a.href = href; a.setAttribute("role", "menuitem"); a.textContent = T(pair); a._pair = pair; navLinks89.push(a); return a;
  }
  if (menu){ menu.appendChild(mk("#writingstudio", W8.title)); menu.appendChild(mk("#sourcedetective", D9.title)); }
})();
/* Today's Path cards (read-only status + links; never writes fx5 keys) */
var today89 = document.createElement("div");
today89.className = "w89-grid2"; today89.id = "w89TodayGrid";
(function(){ var t = $("today"); if (t) t.appendChild(today89); })();

function copyText(text, statusEl, pairCopied, pairManual){
  function done(ok){
    if (!statusEl) return;
    if (ok){ statusEl.textContent = T(pairCopied); return; }
    var ta = document.createElement("textarea");
    ta.className = "w89-ta"; ta.readOnly = true; ta.value = text; ta.setAttribute("aria-label", T(pairManual));
    statusEl.textContent = T(pairManual);
    statusEl.parentNode.insertBefore(ta, statusEl.nextSibling);
    ta.focus(); ta.select();
  }
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){ done(true); }, function(){ done(false); });
  } else done(false);
}

/* =====================================================================
   F08 — Evidence-Based Writing Studio
   ===================================================================== */
var W8_ID = "writing-library-hours-v1";
var w8Current = W8_ID; /* entry key: bundled id, or "lesson-<idx>" */
var w8ExOpen = false, w8ConfirmReset = false, w8Manual = { first: false, rev: false }, w8Msg = "";
function w8Blank(lessonId){
  return { lessonId: lessonId, promptId: W8_ID,
    plan: { claim: "", evidence: "", reasoning: "" }, evidenceNotes: "",
    firstDraft: "", firstDraftSavedAt: null,
    revisionDraft: "", savedRevision: null, revisionSavedAt: null,
    checklist: [false, false, false, false, false],
    comparison: null, completedAt: null, updatedAt: nowIso() };
}
function w8Entry(){
  if (!store8.doc.entries[w8Current]) store8.doc.entries[w8Current] = w8Blank(w8Current);
  var e = store8.doc.entries[w8Current];
  /* schema/length validation on read: repair shape, never drop text */
  if (!e.plan || typeof e.plan !== "object") e.plan = { claim: "", evidence: "", reasoning: "" };
  ["claim", "evidence", "reasoning"].forEach(function(k){ if (typeof e.plan[k] !== "string") e.plan[k] = ""; });
  if (typeof e.evidenceNotes !== "string") e.evidenceNotes = "";
  if (typeof e.firstDraft !== "string") e.firstDraft = "";
  if (typeof e.revisionDraft !== "string") e.revisionDraft = "";
  if (!Array.isArray(e.checklist) || e.checklist.length !== 5) e.checklist = [false, false, false, false, false];
  return e;
}
function w8StatusOf(e){
  if (e.completedAt) return W8.stDone;
  if (e.firstDraftSavedAt) return W8.stRev;
  if (e.plan.claim || e.plan.evidence || e.plan.reasoning || e.evidenceNotes || e.firstDraft) return W8.stPlan;
  return W8.stNot;
}
function w8AnyStatus(){
  var ids = Object.keys(store8.doc.entries || {});
  var best = null;
  ids.forEach(function(id){ var e = store8.doc.entries[id]; var s = w8StatusOf(e); if (e.completedAt) best = W8.stDone; else if (!best && s !== W8.stNot) best = s; });
  return best || W8.stNot;
}
function w8Save(msgEl){
  var e = w8Entry(); e.updatedAt = nowIso();
  var ok = store8.save();
  if (msgEl) msgEl.textContent = store8.conflict ? T(W8.conflict) : (ok ? T(W8.saveOk) : T(W8.saveFail));
  return ok;
}
var w8SaveDeb = debounce(function(){ w8Save($("w8SaveMsg")); refreshToday89(); }, 400);
function splitSentences(text){
  /* tokenize keeping exact character offsets of trimmed spans */
  var out = [];
  var re = /[^.!?。？！\n]+[.!?。？！]?/g, m;
  while ((m = re.exec(text)) !== null){
    var raw = m[0]; var trimmed = raw.trim();
    if (!trimmed) continue;
    var s = m.index + raw.indexOf(trimmed);
    out.push({ start: s, end: s + trimmed.length, text: trimmed });
  }
  return out;
}
function w8CompValid(e){
  if (!e.comparison || !e.comparison.first || !e.comparison.revised || !e.savedRevision || !e.firstDraftSavedAt) return false;
  var c = e.comparison;
  if (c.revisionSavedAt !== e.revisionSavedAt) return false;
  if (e.firstDraft.slice(c.first.start, c.first.end) !== c.first.text) return false;
  if (e.savedRevision.slice(c.revised.start, c.revised.end) !== c.revised.text) return false;
  return true;
}
function w8DraftWithHl(text, sel){
  /* render selectable sentence buttons; selected sentence highlighted */
  var sents = splitSentences(text);
  if (!sents.length) return "<p class='w89-note'>" + esc(text) + "</p>";
  var h = "";
  sents.forEach(function(sn, ix){
    var isSel = sel && sel.start === sn.start && sel.end === sn.end;
    h += "<button type='button' class='w89-sent" + (isSel ? " sel" : "") + "' data-w8sent='" + ix + "' aria-pressed='" + (isSel ? "true" : "false") + "'>" + (isSel ? "<mark class='w89-hl'>" + esc(sn.text) + "</mark>" : esc(sn.text)) + "</button> ";
  });
  return h;
}
function renderW8(){
  var host = secW.querySelector(".w89-host"); if (!host) return;
  if (store8.broken){
    host.innerHTML = "<div class='w89-card'><p class='w89-fb no'>" + esc(T(W8.corrupt)) + "</p><div class='w89-row'>" +
      "<button type='button' class='btn btn-line' id='w8CopyRaw'>" + esc(T(W8.copy)) + "</button>" +
      "<button type='button' class='btn btn-line' id='w8ForceNew'>" + esc(T(W8.newDraft)) + "</button></div><p class='w89-note' id='w8CopyStat' role='status'></p></div>";
    $("w8CopyRaw").addEventListener("click", function(){ copyText(store8.brokenRaw || "", $("w8CopyStat"), W8.copied, W8.copyManual); });
    $("w8ForceNew").addEventListener("click", function(){ try { window.localStorage.removeItem(store8.key); } catch(e){} reloadStores(); w8ConfirmReset = false; renderW8(); refreshToday89(); });
    return;
  }
  var e = w8Entry();
  var status = w8StatusOf(e);
  var revStarted = !!e.firstDraftSavedAt;
  var h = "";
  h += "<div class='w89-card'><div class='w89-row' style='justify-content:space-between'><h3>" + esc(T(W8.promptH)) + "</h3><span class='w89-status" + (e.completedAt ? " done" : "") + "'>" + esc(T(status)) + "</span></div>" +
       "<p style='margin:.2rem 0 0'>" + H(W8.prompt) + "</p>" +
       "<p class='w89-note' id='w8SaveMsg' role='status'>" + esc(store8.conflict ? T(W8.conflict) : (store8.saveOk ? T(W8.saveOk) : T(W8.saveFail))) + "</p>" +
       (store8.conflict ? "<div class='w89-row'><button type='button' class='btn btn-line' id='w8Reload'>" + esc(T(W8.reload)) + "</button><button type='button' class='btn btn-line' id='w8Copy2'>" + esc(T(W8.copy)) + "</button></div>" : "") +
       (w8Msg ? "<p class='w89-fb no' role='alert'>" + esc(w8Msg) + "</p>" : "") + "</div>";
  /* evidence tray */
  h += "<div class='w89-card'><h3>" + esc(T(W8.evH)) + "</h3>";
  W8.evidence.forEach(function(ev){
    h += "<div class='w89-evc'><p style='margin:0 0 .5rem'><span class='w89-evid'>" + ev.id + "</span>" + H(ev.text) + "</p>" +
         "<button type='button' class='btn btn-line' data-w8ev='" + ev.id + "'>" + esc(T(W8.evAdd)) + "</button></div>";
  });
  h += "<label for='w8Notes' style='font-weight:800'>" + esc(T(W8.evNoteLabel)) + "</label>" +
       "<textarea class='w89-ta' id='w8Notes' maxlength='3000' style='min-height:4.5rem'>" + esc(e.evidenceNotes) + "</textarea>" +
       "<p class='w89-count' data-count-for='w8Notes'>" + esc(fill(T(W8.charCount), { n: e.evidenceNotes.length, max: 3000 })) + "</p></div>";
  /* CER plan */
  h += "<div class='w89-card'><h3>" + esc(T(W8.scaffoldH)) + "</h3>";
  [["claim", W8.claimL], ["evidence", W8.evL], ["reasoning", W8.reasL]].forEach(function(spec){
    h += "<label for='w8Plan-" + spec[0] + "' style='font-weight:800;display:block;margin-top:.7rem'>" + esc(T(spec[1])) + "</label>" +
         "<textarea class='w89-ta' id='w8Plan-" + spec[0] + "' data-w8plan='" + spec[0] + "' maxlength='1000' style='min-height:3.8rem'>" + esc(e.plan[spec[0]]) + "</textarea>" +
         "<p class='w89-count' data-count-for='w8Plan-" + spec[0] + "'>" + esc(fill(T(W8.charCount), { n: e.plan[spec[0]].length, max: 1000 })) + "</p>";
  });
  h += "</div>";
  /* exemplar */
  h += "<div class='w89-card'><div class='w89-row'><button type='button' class='btn btn-line' id='w8ExToggle' aria-expanded='" + w8ExOpen + "'>" + esc(T(w8ExOpen ? W8.exHide : W8.exShow)) + "</button></div>";
  if (w8ExOpen){
    h += "<div class='w89-ex'><p style='margin:.7rem 0 .2rem'><b>" + esc(T(W8.exLabel)) + "</b></p>";
    W8.exemplar.forEach(function(x){
      h += "<span class='w89-ann'><span class='w89-anntag'>" + esc(T(x.tag)) + "</span><br>" + H(x.text) + "</span>";
    });
    h += "<p style='margin:.8rem 0 0'>" + esc(T(W8.before)) + ": “" + esc(T(W8.baBefore)) + "” → " + esc(T(W8.after)) + ": “" + esc(T(W8.baAfter)) + "”<br><span class='w89-note'>" + esc(T(W8.improvedTag)) + "</span></p></div>";
  }
  h += "</div>";
  /* first draft */
  h += "<div class='w89-card'><h3>" + esc(T(W8.draftH)) + "</h3>";
  if (!revStarted){
    h += "<textarea class='w89-ta' id='w8Draft' maxlength='8000' placeholder='" + esc(T(W8.draftPh)) + "'>" + esc(e.firstDraft) + "</textarea>" +
         "<p class='w89-count' data-count-for='w8Draft'>" + esc(fill(T(W8.charCount), { n: e.firstDraft.length, max: 8000 })) + "</p>" +
         "<div class='w89-row' style='margin-top:.6rem'><button type='button' class='btn btn-gold' id='w8SaveDraft'>" + esc(T(W8.draftAction)) + "</button></div>";
  } else {
    h += "<div class='w89-draftview' aria-label='" + esc(T(W8.draftH)) + "'>" + esc(e.firstDraft) + "</div>";
  }
  h += "</div>";
  /* revision + checklist + comparison (only after first draft saved) */
  if (revStarted){
    h += "<div class='w89-card'><h3>" + esc(T(W8.revH)) + "</h3><p class='w89-sub'>" + esc(T(W8.revHint)) + "</p>" +
         "<textarea class='w89-ta' id='w8Rev' maxlength='8000'>" + esc(e.revisionDraft) + "</textarea>" +
         "<p class='w89-count' data-count-for='w8Rev'>" + esc(fill(T(W8.charCount), { n: e.revisionDraft.length, max: 8000 })) + "</p>" +
         "<div class='w89-row' style='margin-top:.6rem'><button type='button' class='btn btn-gold' id='w8SaveRev'>" + esc(T(W8.revAction)) + "</button></div>" +
         "<p class='w89-note'>" + esc(T(W8.savedRevNote)) + "</p></div>";
    h += "<div class='w89-card'><h3>" + esc(T(W8.checkH)) + "</h3>";
    W8.checklist.forEach(function(item, ix){
      h += "<label class='w89-check'><input type='checkbox' data-w8check='" + ix + "'" + (e.checklist[ix] ? " checked" : "") + "><span>" + H(item) + "</span></label>";
    });
    h += "</div>";
    h += "<div class='w89-card'><h3>" + esc(T(W8.compH)) + "</h3>";
    if (!e.savedRevision){
      h += "<p class='w89-fb no'>" + esc(T(W8.errNoRev)) + "</p>";
    } else {
      var compOk = w8CompValid(e);
      h += "<p style='font-weight:800;margin:.4rem 0 .3rem'>" + esc(T(W8.before)) + " — " + esc(T(W8.sentFirst)) + "</p>" +
           "<div class='w89-draftview' data-w8side='first'>" + w8DraftWithHl(e.firstDraft, compOk ? e.comparison.first : (e.comparison ? e.comparison.first : null)) + "</div>" +
           "<div class='w89-row' style='margin:.4rem 0'><button type='button' class='btn btn-line' data-w8manual='first'>" + esc(T(W8.manual)) + "</button></div>" +
           (w8Manual.first ? "<textarea class='w89-ta' id='w8ManFirst' style='min-height:4rem'>" + esc(e.firstDraft) + "</textarea><p class='w89-note'>" + esc(T(W8.manualHint)) + "</p><div class='w89-row'><button type='button' class='btn btn-line' id='w8UseFirst'>" + esc(T(W8.useSel)) + "</button></div>" : "") +
           "<p style='font-weight:800;margin:.8rem 0 .3rem'>" + esc(T(W8.after)) + " — " + esc(T(W8.sentRev)) + "</p>" +
           "<div class='w89-draftview' data-w8side='rev'>" + w8DraftWithHl(e.savedRevision, compOk ? e.comparison.revised : (e.comparison ? e.comparison.revised : null)) + "</div>" +
           "<div class='w89-row' style='margin:.4rem 0'><button type='button' class='btn btn-line' data-w8manual='rev'>" + esc(T(W8.manual)) + "</button></div>" +
           (w8Manual.rev ? "<textarea class='w89-ta' id='w8ManRev' style='min-height:4rem'>" + esc(e.savedRevision) + "</textarea><p class='w89-note'>" + esc(T(W8.manualHint)) + "</p><div class='w89-row'><button type='button' class='btn btn-line' id='w8UseRev'>" + esc(T(W8.useSel)) + "</button></div>" : "");
    }
    h += "</div>";
  }
  /* footer actions */
  h += "<div class='w89-card'><div class='w89-row'>" +
       "<button type='button' class='btn btn-gold' id='w8Finish'>" + esc(T(W8.finish)) + "</button>" +
       "<button type='button' class='btn btn-line' id='w8Copy'>" + esc(T(W8.copy)) + "</button>" +
       "<button type='button' class='btn btn-line' id='w8Retry' hidden>" + esc(T(W8.tryAgain)) + "</button>" +
       "<button type='button' class='btn btn-line' id='w8New'>" + esc(T(W8.newDraft)) + "</button></div>" +
       "<p class='w89-note' id='w8CopyStat' role='status'></p>" +
       (w8ConfirmReset ? "<div class='w89-fb no'><p style='margin:0 0 .5rem'>" + esc(T(W8.newConfirm)) + "</p><div class='w89-row'><button type='button' class='btn btn-gold' id='w8NewYes'>" + esc(T(W8.confirmYes)) + "</button><button type='button' class='btn btn-line' id='w8NewNo'>" + esc(T(W8.cancel)) + "</button></div></div>" : "") +
       "</div>";
  host.innerHTML = h;
  bindW8(host, e);
}
function w8CountUpdate(id){
  var ta = $(id); if (!ta) return;
  var p = secW.querySelector("[data-count-for='" + id + "']");
  if (p) p.textContent = fill(T(W8.charCount), { n: ta.value.length, max: ta.maxLength > 0 ? ta.maxLength : 8000 });
}
function bindW8(host, e){
  var rl = $("w8Reload"); if (rl) rl.addEventListener("click", function(){ store8.conflict = false; reloadStores(); renderW8(); });
  var cp2 = $("w8Copy2"); if (cp2) cp2.addEventListener("click", function(){ $("w8Copy").click(); });
  host.querySelectorAll("[data-w8ev]").forEach(function(b){
    b.addEventListener("click", function(){
      var ev = null; W8.evidence.forEach(function(x){ if (x.id === b.getAttribute("data-w8ev")) ev = x; });
      if (!ev) return;
      var ta = $("w8Notes"); if (!ta) return;
      var ref = ev.id + " — " + T(ev.text);
      var pos = ta.selectionStart != null ? ta.selectionStart : ta.value.length;
      ta.value = (ta.value.slice(0, pos) + (pos && ta.value[pos - 1] !== "\n" ? "\n" : "") + ref + "\n" + ta.value.slice(pos)).slice(0, 3000);
      e.evidenceNotes = ta.value; w8CountUpdate("w8Notes"); w8SaveDeb(); ta.focus();
    });
  });
  var notes = $("w8Notes");
  if (notes){ notes.addEventListener("input", function(){ e.evidenceNotes = notes.value; w8CountUpdate("w8Notes"); w8SaveDeb(); }); notes.addEventListener("blur", function(){ w8Save($("w8SaveMsg")); }); }
  host.querySelectorAll("[data-w8plan]").forEach(function(ta){
    ta.addEventListener("input", function(){ e.plan[ta.getAttribute("data-w8plan")] = ta.value; w8CountUpdate(ta.id); w8SaveDeb(); });
    ta.addEventListener("blur", function(){ w8Save($("w8SaveMsg")); });
  });
  var exT = $("w8ExToggle"); if (exT) exT.addEventListener("click", function(){ w8ExOpen = !w8ExOpen; renderW8(); });
  var draft = $("w8Draft");
  if (draft){ draft.addEventListener("input", function(){ e.firstDraft = draft.value; w8CountUpdate("w8Draft"); w8SaveDeb(); }); draft.addEventListener("blur", function(){ w8Save($("w8SaveMsg")); }); }
  var sd = $("w8SaveDraft");
  if (sd) sd.addEventListener("click", function(){
    if (!e.firstDraft || !e.firstDraft.trim()){ w8Msg = T(W8.errNoDraft); renderW8(); return; }
    w8Msg = ""; e.firstDraftSavedAt = nowIso();
    if (!e.revisionDraft) e.revisionDraft = e.firstDraft;
    w8Save($("w8SaveMsg")); renderW8(); refreshToday89();
    var rv = $("w8Rev"); if (rv) rv.focus();
  });
  var rev = $("w8Rev");
  if (rev){ rev.addEventListener("input", function(){
      e.revisionDraft = rev.value; w8CountUpdate("w8Rev");
      if (e.savedRevision && e.revisionDraft !== e.savedRevision){ if (e.comparison) e.comparison = null; if (e.completedAt) e.completedAt = null; }
      w8SaveDeb();
    }); rev.addEventListener("blur", function(){ w8Save($("w8SaveMsg")); }); }
  var sr = $("w8SaveRev");
  if (sr) sr.addEventListener("click", function(){
    if (!e.revisionDraft || !e.revisionDraft.trim()){ w8Msg = T(W8.errNoRev); renderW8(); return; }
    w8Msg = ""; e.savedRevision = e.revisionDraft; e.revisionSavedAt = nowIso(); e.comparison = null;
    w8Save($("w8SaveMsg")); renderW8(); refreshToday89();
  });
  host.querySelectorAll("[data-w8check]").forEach(function(cb){
    cb.addEventListener("change", function(){ e.checklist[+cb.getAttribute("data-w8check")] = cb.checked; w8Save($("w8SaveMsg")); });
  });
  host.querySelectorAll("[data-w8side]").forEach(function(box){
    var side = box.getAttribute("data-w8side");
    box.querySelectorAll("[data-w8sent]").forEach(function(b){
      b.addEventListener("click", function(){
        var text = side === "first" ? e.firstDraft : e.savedRevision;
        var sn = splitSentences(text)[+b.getAttribute("data-w8sent")]; if (!sn) return;
        if (!e.comparison) e.comparison = { first: null, revised: null, revisionSavedAt: e.revisionSavedAt };
        e.comparison.revisionSavedAt = e.revisionSavedAt;
        if (side === "first") e.comparison.first = sn; else e.comparison.revised = sn;
        if (!e.comparison.first || !e.comparison.revised){ /* keep partial picks in memory only until both chosen */ }
        w8Save($("w8SaveMsg")); renderW8();
      });
    });
  });
  host.querySelectorAll("[data-w8manual]").forEach(function(b){
    b.addEventListener("click", function(){ var s = b.getAttribute("data-w8manual"); if (s === "first") w8Manual.first = true; else w8Manual.rev = true; renderW8(); });
  });
  function useManual(taId, side){
    var ta = $(taId); if (!ta) return;
    var s = ta.selectionStart, en = ta.selectionEnd;
    var text = side === "first" ? e.firstDraft : e.savedRevision;
    if (s == null || en == null || en <= s){ w8Msg = T(W8.notExact); renderW8(); return; }
    var picked = ta.value.slice(s, en);
    var idx = text.indexOf(picked);
    if (idx < 0 || picked !== text.slice(idx, idx + picked.length)){ w8Msg = T(W8.notExact); renderW8(); return; }
    w8Msg = "";
    if (!e.comparison) e.comparison = { first: null, revised: null, revisionSavedAt: e.revisionSavedAt };
    e.comparison.revisionSavedAt = e.revisionSavedAt;
    var sn = { start: idx, end: idx + picked.length, text: picked };
    if (side === "first") e.comparison.first = sn; else e.comparison.revised = sn;
    w8Save($("w8SaveMsg")); renderW8();
  }
  var uf = $("w8UseFirst"); if (uf) uf.addEventListener("click", function(){ useManual("w8ManFirst", "first"); });
  var ur = $("w8UseRev"); if (ur) ur.addEventListener("click", function(){ useManual("w8ManRev", "rev"); });
  var fin = $("w8Finish");
  if (fin) fin.addEventListener("click", function(){
    if (!e.firstDraftSavedAt || !e.savedRevision || !e.revisionDraft.trim()){ w8Msg = T(W8.errNoRev); renderW8(); return; }
    if (!e.comparison || !e.comparison.first || !e.comparison.revised || !w8CompValid(e)){ w8Msg = T(W8.errNoSent); renderW8(); return; }
    if (e.checklist.some(function(c){ return !c; })){ w8Msg = T(W8.errChecklist); renderW8(); return; }
    w8Msg = ""; e.completedAt = nowIso(); w8Save($("w8SaveMsg")); renderW8(); refreshToday89();
  });
  var cp = $("w8Copy");
  if (cp) cp.addEventListener("click", function(){
    var parts = [];
    parts.push(T(W8.claimL) + "\n" + e.plan.claim, T(W8.evL) + "\n" + e.plan.evidence, T(W8.reasL) + "\n" + e.plan.reasoning, T(W8.evNoteLabel) + "\n" + e.evidenceNotes, T(W8.draftH) + "\n" + e.firstDraft, T(W8.revH) + "\n" + (e.savedRevision || e.revisionDraft));
    copyText(parts.join("\n\n"), $("w8CopyStat"), W8.copied, W8.copyManual);
  });
  var nw = $("w8New"); if (nw) nw.addEventListener("click", function(){ w8ConfirmReset = true; renderW8(); });
  var ny = $("w8NewYes"); if (ny) ny.addEventListener("click", function(){ delete store8.doc.entries[w8Current]; w8ConfirmReset = false; w8Msg = ""; store8.save(); renderW8(); refreshToday89(); });
  var nn = $("w8NewNo"); if (nn) nn.addEventListener("click", function(){ w8ConfirmReset = false; renderW8(); });
}

/* =====================================================================
   F09 — Source Detective
   ===================================================================== */
var PAIR = D9.pair;
var d9View = "side"; /* side | A | B */
var d9Checked = false, d9Msg = "", d9ConfirmReset = false;
function d9BlankInv(){ return { authorChoiceId: null, purposeChoiceId: null, claimChoiceId: null, evidenceLineIds: [], limitationChoiceId: null }; }
function d9Blank(){
  return { pairId: PAIR.id, contentVersion: 1, sources: { A: d9BlankInv(), B: d9BlankInv() }, difference: "", response: "", insertedCitations: [], checkedAt: null, completedAt: null, updatedAt: nowIso() };
}
function d9Entry(){
  if (!store9.doc.pairs[PAIR.id]) store9.doc.pairs[PAIR.id] = d9Blank();
  var p = store9.doc.pairs[PAIR.id];
  if (p.contentVersion !== 1){ p = d9Blank(); store9.doc.pairs[PAIR.id] = p; }
  ["A", "B"].forEach(function(s){ if (!p.sources[s]) p.sources[s] = d9BlankInv(); if (!Array.isArray(p.sources[s].evidenceLineIds)) p.sources[s].evidenceLineIds = []; });
  if (typeof p.difference !== "string") p.difference = "";
  if (typeof p.response !== "string") p.response = "";
  if (!Array.isArray(p.insertedCitations)) p.insertedCitations = [];
  return p;
}
function d9StatusOf(p){
  if (p.completedAt) return D9.stDone;
  var any = p.difference || p.response || ["A", "B"].some(function(s){ var i = p.sources[s]; return i.authorChoiceId || i.purposeChoiceId || i.claimChoiceId || i.limitationChoiceId || i.evidenceLineIds.length; });
  return any ? D9.stProg : D9.stNot;
}
function d9Save(msgEl){
  var p = d9Entry(); p.updatedAt = nowIso();
  var ok = store9.save();
  if (msgEl) msgEl.textContent = store9.conflict ? T(D9.conflict) : (ok ? T(D9.savedNote) : T(D9.saveFail));
  return ok;
}
var d9SaveDeb = debounce(function(){ d9Save($("d9SaveMsg")); refreshToday89(); }, 400);
function d9Invalidate(){ var p = d9Entry(); if (p.checkedAt || p.completedAt){ p.checkedAt = null; p.completedAt = null; } d9Checked = false; }
function citeText(src, lineId){
  var n = lineId.slice(1);
  return isZh() ? "（资料 " + src + "，第 " + n + " 行）" : "(Source " + src + ", line " + n + ")";
}
function d9SyncCitations(){
  var p = d9Entry();
  /* drop records whose inserted text was removed */
  p.insertedCitations = p.insertedCitations.filter(function(c){
    return p.response.indexOf(citeText(c.source, c.lineId)) >= 0 || p.response.indexOf("(Source " + c.source + ", line " + c.lineId.slice(1) + ")") >= 0 || p.response.indexOf("（资料 " + c.source + "，第 " + c.lineId.slice(1) + " 行）") >= 0;
  });
  /* match manually typed citations */
  ["A", "B"].forEach(function(src){
    PAIR[src].lines.forEach(function(ln){
      var en = "(Source " + src + ", line " + ln.id.slice(1) + ")";
      var zh = "（资料 " + src + "，第 " + ln.id.slice(1) + " 行）";
      var has = p.response.indexOf(en) >= 0 || p.response.indexOf(zh) >= 0;
      var rec = p.insertedCitations.some(function(c){ return c.source === src && c.lineId === ln.id; });
      if (has && !rec) p.insertedCitations.push({ source: src, lineId: ln.id });
    });
  });
}
function d9ResponseBeyondCitation(){
  var p = d9Entry();
  var txt = p.response;
  p.insertedCitations.forEach(function(c){ txt = txt.split(citeText(c.source, c.lineId)).join(""); txt = txt.split("(Source " + c.source + ", line " + c.lineId.slice(1) + ")").join(""); txt = txt.split("（资料 " + c.source + "，第 " + c.lineId.slice(1) + " 行）").join(""); });
  return txt.trim().length >= 3;
}
function d9ChoiceGroup(pairList, cur, attr, srcKey, field, checkedFb){
  var h = "";
  pairList.forEach(function(opt){
    var sel = cur === opt.id;
    var cls = "w89-opt";
    if (d9Checked && checkedFb){ cls += sel ? (checkedFb.correct ? " right" : " wrong") : ""; }
    h += "<button type='button' class='" + cls + "' role='radio' aria-checked='" + (sel ? "true" : "false") + "' data-d9choice='" + attr + "' data-src='" + srcKey + "' data-field='" + field + "' data-val='" + opt.id + "'>" + H(opt.text) + "</button>";
  });
  return h;
}
function renderD9(){
  var host = secD.querySelector(".w89-host"); if (!host) return;
  if (store9.broken){
    host.innerHTML = "<div class='w89-card'><p class='w89-fb no'>" + esc(T(D9.corrupt)) + "</p><div class='w89-row'>" +
      "<button type='button' class='btn btn-line' id='d9CopyRaw'>" + esc(T(D9.copyResp)) + "</button>" +
      "<button type='button' class='btn btn-line' id='d9ForceNew'>" + esc(T(D9.reset)) + "</button></div><p class='w89-note' id='d9CopyStat' role='status'></p></div>";
    $("d9CopyRaw").addEventListener("click", function(){ copyText(store9.brokenRaw || "", $("d9CopyStat"), D9.copied, D9.copyManual); });
    $("d9ForceNew").addEventListener("click", function(){ try { window.localStorage.removeItem(store9.key); } catch(e){} reloadStores(); renderD9(); refreshToday89(); });
    return;
  }
  var p = d9Entry();
  if (p.checkedAt) d9Checked = true;
  var status = d9StatusOf(p);
  var h = "";
  h += "<div class='w89-card'><div class='w89-row' style='justify-content:space-between'><span class='w89-status" + (p.completedAt ? " done" : "") + "'>" + esc(T(status)) + "</span><span class='w89-note' id='d9SaveMsg' role='status'>" + esc(store9.conflict ? T(D9.conflict) : T(D9.savedNote)) + "</span></div>" +
       "<p class='w89-fb ok' role='note' style='margin:.6rem 0 0'>" + esc(T(D9.notice)) + "</p>" +
       (store9.conflict ? "<div class='w89-row' style='margin-top:.5rem'><button type='button' class='btn btn-line' id='d9Reload'>" + esc(T(D9.reload)) + "</button></div>" : "") +
       (d9Msg ? "<p class='w89-fb no' role='alert'>" + esc(d9Msg) + "</p>" : "") +
       "<div class='w89-row' style='margin-top:.7rem' role='group' aria-label='" + esc(T(D9.srcA)) + " / " + esc(T(D9.srcB)) + "'>" +
       "<button type='button' class='btn " + (d9View === "A" ? "btn-gold" : "btn-line") + "' data-d9view='A'>" + esc(T(D9.srcA)) + "</button>" +
       "<button type='button' class='btn " + (d9View === "B" ? "btn-gold" : "btn-line") + "' data-d9view='B'>" + esc(T(D9.srcB)) + "</button>" +
       "<button type='button' class='btn " + (d9View === "side" ? "btn-gold" : "btn-line") + "' data-d9view='side'>" + esc(T(D9.side)) + "</button></div></div>";
  /* sources */
  h += "<div class='w89-srcgrid" + (d9View === "side" ? " side" : "") + "'>";
  ["A", "B"].forEach(function(src){
    if (d9View !== "side" && d9View !== src) return;
    var S = PAIR[src];
    var authorPair = null; D9.authors.forEach(function(a){ if (a.id === S.authorId) authorPair = a.text; });
    var inv = p.sources[src];
    h += "<div class='w89-card' style='margin:0'><h3>" + esc(T(src === "A" ? D9.srcA : D9.srcB)) + " — " + H(S.title) + "</h3>" +
         "<p class='w89-note' style='margin:0 0 .4rem'>" + esc(T(D9.qAuthor)) + " " + H(authorPair) + "</p>";
    S.lines.forEach(function(ln){
      var marked = inv.evidenceLineIds.indexOf(ln.id) >= 0;
      h += "<div class='w89-srcline" + (marked ? " marked" : "") + "'><span class='w89-lineno'>" + ln.id + "</span><span style='flex:1'>" + H(ln.text) + "</span>" +
           "<button type='button' class='w89-citebtn' data-d9cite='" + src + ":" + ln.id + "'>" + esc(T(D9.cite)) + "</button></div>";
    });
    h += "</div>";
  });
  h += "</div>";
  /* investigations */
  ["A", "B"].forEach(function(src){
    var S = PAIR[src]; var inv = p.sources[src];
    h += "<div class='w89-card' style='margin-top:1rem'><h3>" + esc(T(src === "A" ? D9.srcA : D9.srcB)) + "</h3>";
    h += "<p style='font-weight:800;margin:.6rem 0 .2rem'>" + esc(T(D9.qAuthor)) + "</p><div role='radiogroup'>" + d9ChoiceGroup(D9.authors, inv.authorChoiceId, "author", src, "authorChoiceId", { correct: inv.authorChoiceId === S.authorId }) + "</div>";
    h += "<p style='font-weight:800;margin:.8rem 0 .2rem'>" + esc(T(D9.qPurpose)) + "</p><div role='radiogroup'>" + d9ChoiceGroup(D9.purposes, inv.purposeChoiceId, "purpose", src, "purposeChoiceId", { correct: inv.purposeChoiceId === S.purposeId }) + "</div>";
    h += "<p style='font-weight:800;margin:.8rem 0 .2rem'>" + esc(T(D9.qClaim)) + "</p><div role='radiogroup'>" + d9ChoiceGroup(D9.claims, inv.claimChoiceId, "claim", src, "claimChoiceId", { correct: inv.claimChoiceId === S.claimId }) + "</div>";
    h += "<p style='font-weight:800;margin:.8rem 0 .2rem'>" + esc(T(D9.qEvidence)) + "</p>";
    S.lines.forEach(function(ln){
      var sel = inv.evidenceLineIds.indexOf(ln.id) >= 0;
      h += "<button type='button' class='w89-opt' aria-pressed='" + (sel ? "true" : "false") + "' data-d9ev='" + src + ":" + ln.id + "'><span class='w89-lineno'>" + ln.id + "</span> " + H(ln.text) + "</button>";
    });
    h += "<p style='font-weight:800;margin:.8rem 0 .2rem'>" + esc(T(D9.qLimit)) + "</p><div role='radiogroup'>" + d9ChoiceGroup(D9.limits, inv.limitationChoiceId, "limit", src, "limitationChoiceId", { correct: inv.limitationChoiceId === S.limitId }) + "</div>";
    h += "</div>";
  });
  /* difference + response */
  h += "<div class='w89-card'><h3 id='d9DiffPrompt'>" + esc(T(D9.diffPrompt)) + "</h3>" +
       "<textarea class='w89-ta' id='d9Diff' aria-labelledby='d9DiffPrompt' maxlength='1000' style='min-height:4.5rem'>" + esc(p.difference) + "</textarea>" +
       "<p class='w89-count' id='d9DiffCount'>" + esc(fill(T(D9.charCount), { n: p.difference.length, max: 1000 })) + "</p>" +
       "<h3 id='d9RespPrompt' style='margin-top:1rem'>" + esc(T(D9.respPrompt)) + "</h3>" +
       "<textarea class='w89-ta' id='d9Resp' aria-labelledby='d9RespPrompt' aria-describedby='d9RespHint' maxlength='2000'>" + esc(p.response) + "</textarea>" +
       "<p class='w89-count' id='d9RespCount'>" + esc(fill(T(D9.charCount), { n: p.response.length, max: 2000 })) + "</p>" +
       "<p class='w89-note' id='d9RespHint'>" + esc(T(D9.respHint)) + "</p>" +
       "<div class='w89-row' style='margin-top:.6rem'>" +
       "<button type='button' class='btn btn-line' id='d9SaveBtn'>" + esc(T(D9.saveLater)) + "</button>" +
       "<button type='button' class='btn btn-gold' id='d9Check'>" + esc(T(D9.check)) + "</button>" +
       "<button type='button' class='btn btn-line' id='d9Revise'>" + esc(T(D9.revise)) + "</button>" +
       "<button type='button' class='btn btn-line' id='d9Another'>" + esc(T(D9.another)) + "</button>" +
       "<button type='button' class='btn btn-line' id='d9Copy'>" + esc(T(D9.copyResp)) + "</button>" +
       "<button type='button' class='btn btn-line' id='d9Reset'>" + esc(T(D9.reset)) + "</button></div>" +
       "<p class='w89-note' id='d9CopyStat' role='status'></p>" +
       (d9ConfirmReset ? "<div class='w89-fb no'><p style='margin:0 0 .5rem'>" + esc(T(D9.resetConfirm)) + "</p><div class='w89-row'><button type='button' class='btn btn-gold' id='d9ResetYes'>" + esc(T(D9.confirmYes)) + "</button><button type='button' class='btn btn-line' id='d9ResetNo'>" + esc(T(D9.cancel)) + "</button></div></div>" : "") +
       "</div>";
  /* feedback */
  if (d9Checked && p.checkedAt){
    h += "<div class='w89-card'><h3>" + esc(T(D9.fbCompare)) + "</h3>";
    ["A", "B"].forEach(function(src){
      var S = PAIR[src]; var inv = p.sources[src];
      function line(labelPair, ok){ return "<p style='margin:.35rem 0'><b>" + esc(T(src === "A" ? D9.srcA : D9.srcB)) + " · " + esc(T(labelPair)) + "</b> — " + esc(T(ok ? D9.matchKey : D9.diffKey)) + "</p>"; }
      h += line(D9.qAuthor, inv.authorChoiceId === S.authorId);
      h += line(D9.qPurpose, inv.purposeChoiceId === S.purposeId);
      h += line(D9.qClaim, inv.claimChoiceId === S.claimId);
      var evOk = inv.evidenceLineIds.some(function(id){ return S.goodLines.indexOf(id) >= 0; });
      h += line(D9.qEvidence, evOk);
      h += line(D9.qLimit, inv.limitationChoiceId === S.limitId);
    });
    h += "<h3 style='margin-top:1rem'>" + esc(T(D9.fbPossible)) + "</h3>" +
         "<p>" + H(D9.diffExample) + "</p>" +
         "<p class='w89-note'>" + esc(T(D9.freeNote)) + "</p>" +
         "<h3 style='margin-top:1rem'>" + esc(T(D9.fbCite)) + "</h3>" +
         (p.insertedCitations.length ? "<p class='w89-fb ok'>" + esc(T(D9.citePresent)) + "</p><p class='w89-note'>" + p.insertedCitations.map(function(c){ return esc(citeText(c.source, c.lineId)); }).join(" · ") + "</p>" : "<p class='w89-fb no'>" + esc(T(D9.valCite)) + "</p>") +
         "</div>";
  }
  host.innerHTML = h;
  bindD9(host, p);
}
function bindD9(host, p){
  var rl = $("d9Reload"); if (rl) rl.addEventListener("click", function(){ store9.conflict = false; reloadStores(); d9Checked = false; renderD9(); });
  host.querySelectorAll("[data-d9view]").forEach(function(b){ b.addEventListener("click", function(){ d9View = b.getAttribute("data-d9view"); renderD9(); }); });
  host.querySelectorAll("[data-d9choice]").forEach(function(b){
    b.addEventListener("click", function(){
      var src = b.getAttribute("data-src"), field = b.getAttribute("data-field");
      p.sources[src][field] = b.getAttribute("data-val");
      d9Invalidate(); d9Save($("d9SaveMsg")); renderD9(); refreshToday89();
    });
  });
  host.querySelectorAll("[data-d9ev]").forEach(function(b){
    b.addEventListener("click", function(){
      var parts = b.getAttribute("data-d9ev").split(":"); var inv = p.sources[parts[0]];
      var ix = inv.evidenceLineIds.indexOf(parts[1]);
      if (ix >= 0) inv.evidenceLineIds.splice(ix, 1); else inv.evidenceLineIds.push(parts[1]);
      d9Invalidate(); d9Save($("d9SaveMsg")); renderD9(); refreshToday89();
    });
  });
  host.querySelectorAll("[data-d9cite]").forEach(function(b){
    b.addEventListener("click", function(){
      var parts = b.getAttribute("data-d9cite").split(":");
      var ta = $("d9Resp"); if (!ta) return;
      ta.focus();
      var ct = " " + citeText(parts[0], parts[1]) + " ";
      var pos = ta.selectionStart != null ? ta.selectionStart : ta.value.length;
      ta.value = (ta.value.slice(0, pos) + ct + ta.value.slice(pos)).slice(0, 2000);
      p.response = ta.value;
      if (!p.insertedCitations.some(function(c){ return c.source === parts[0] && c.lineId === parts[1]; })) p.insertedCitations.push({ source: parts[0], lineId: parts[1] });
      d9Invalidate(); d9Save($("d9SaveMsg"));
      var rc = $("d9RespCount"); if (rc) rc.textContent = fill(T(D9.charCount), { n: ta.value.length, max: 2000 });
      ta.focus(); ta.setSelectionRange(pos + ct.length, pos + ct.length);
    });
  });
  var diff = $("d9Diff");
  if (diff){ diff.addEventListener("input", function(){ p.difference = diff.value; d9Invalidate(); var c = $("d9DiffCount"); if (c) c.textContent = fill(T(D9.charCount), { n: diff.value.length, max: 1000 }); d9SaveDeb(); }); diff.addEventListener("blur", function(){ d9Save($("d9SaveMsg")); }); }
  var resp = $("d9Resp");
  if (resp){ resp.addEventListener("input", function(){ p.response = resp.value; d9SyncCitations(); d9Invalidate(); var c = $("d9RespCount"); if (c) c.textContent = fill(T(D9.charCount), { n: resp.value.length, max: 2000 }); d9SaveDeb(); }); resp.addEventListener("blur", function(){ d9SyncCitations(); d9Save($("d9SaveMsg")); }); }
  var sv = $("d9SaveBtn"); if (sv) sv.addEventListener("click", function(){ d9SyncCitations(); d9Save($("d9SaveMsg")); refreshToday89(); });
  var ck = $("d9Check");
  if (ck) ck.addEventListener("click", function(){
    d9SyncCitations();
    var complete = ["A", "B"].every(function(s){ var i = p.sources[s]; return i.authorChoiceId && i.purposeChoiceId && i.claimChoiceId && i.limitationChoiceId && i.evidenceLineIds.length > 0; });
    if (!complete || !p.difference.trim()){ d9Msg = T(D9.valAll); renderD9(); return; }
    if (!p.insertedCitations.length || !d9ResponseBeyondCitation()){ d9Msg = T(D9.valCite); renderD9(); return; }
    d9Msg = ""; p.checkedAt = nowIso(); p.completedAt = p.checkedAt; d9Checked = true;
    d9Save($("d9SaveMsg")); renderD9(); refreshToday89();
    var fb = secD.querySelector(".w89-host"); if (fb) fb.scrollIntoView({ block: "nearest" });
  });
  var rv = $("d9Revise"); if (rv) rv.addEventListener("click", function(){ var first = secD.querySelector("[data-d9choice]"); if (first){ first.focus(); first.scrollIntoView({ block: "center" }); } });
  var an = $("d9Another"); if (an) an.addEventListener("click", function(){ d9Msg = T(D9.onlyPair); renderD9(); });
  var cp = $("d9Copy"); if (cp) cp.addEventListener("click", function(){ copyText(p.response || "", $("d9CopyStat"), D9.copied, D9.copyManual); });
  var rs = $("d9Reset"); if (rs) rs.addEventListener("click", function(){ d9ConfirmReset = true; renderD9(); });
  var ry = $("d9ResetYes"); if (ry) ry.addEventListener("click", function(){ delete store9.doc.pairs[PAIR.id]; d9ConfirmReset = false; d9Checked = false; d9Msg = ""; store9.save(); renderD9(); refreshToday89(); });
  var rn = $("d9ResetNo"); if (rn) rn.addEventListener("click", function(){ d9ConfirmReset = false; renderD9(); });
}

/* ---------------- Today's Path cards + lesson links ---------------- */
function refreshToday89(){
  if (!today89) return;
  var wStatus = store8.broken ? W8.stNot : w8AnyStatus();
  var p9 = store9.broken ? null : d9Entry();
  var dStatus = p9 ? d9StatusOf(p9) : D9.stNot;
  today89.innerHTML =
    "<div class='w89-card' style='margin:0'><h3>" + esc(T(W8.title)) + "</h3><p class='w89-sub'>" + esc(T(W8.intro)) + "</p>" +
    "<p><span class='w89-status" + (wStatus === W8.stDone ? " done" : "") + "'>" + esc(T(wStatus)) + "</span></p>" +
    "<a class='btn btn-gold' href='#writingstudio'>" + esc(T(wStatus === W8.stNot ? W8.openStudio : W8.continueWriting)) + "</a></div>" +
    "<div class='w89-card' style='margin:0'><h3>" + esc(T(D9.title)) + "</h3><p class='w89-sub'>" + esc(T(D9.intro)) + "</p>" +
    "<p><span class='w89-status" + (dStatus === D9.stDone ? " done" : "") + "'>" + esc(T(dStatus)) + "</span></p>" +
    "<a class='btn btn-gold' href='#sourcedetective'>" + esc(T(D9.openDetective)) + "</a></div>";
}
function fx89OnLesson(lid){
  var L = LESSONS[lid]; if (!L) return;
  var trySec = $("mTrySec"); if (!trySec || !trySec.parentNode) return;
  var old = $("w89LessonLinks"); if (old) old.remove();
  var showW = L.s === "english" || L.s === "history";
  var showD = L.s === "history" || L.s === "english";
  if (!showW && !showD) return;
  var div = document.createElement("div");
  div.id = "w89LessonLinks"; div.className = "w89-lessonlink";
  var h = "";
  if (showW){
    var key = "lesson-" + lid;
    var e = store8.doc.entries[key];
    var st = e ? w8StatusOf(e) : W8.stNot;
    h += "<p style='margin:0 0 .4rem'><b>" + esc(T(W8.title)) + "</b> <span class='w89-status" + (st === W8.stDone ? " done" : "") + "'>" + esc(T(st)) + "</span></p>" +
         "<p class='w89-note' style='margin:0 0 .5rem'>" + esc(T(W8.lessonLinkNote)) + "</p>" +
         "<button type='button' class='btn btn-line' data-w89open='" + key + "'>" + esc(T(st === W8.stNot ? W8.openStudio : W8.continueWriting)) + "</button>";
  }
  if (showD){
    var p9 = null; try { p9 = d9Entry(); } catch(e){}
    var dst = p9 ? d9StatusOf(p9) : D9.stNot;
    h += "<p style='margin:.8rem 0 .4rem'><b>" + esc(T(D9.title)) + "</b> <span class='w89-status" + (dst === D9.stDone ? " done" : "") + "'>" + esc(T(dst)) + "</span></p>" +
         "<p class='w89-note' style='margin:0 0 .5rem'>" + esc(T(D9.lessonLinkNote)) + "</p>" +
         "<a class='btn btn-line' href='#sourcedetective' data-w89det='1'>" + esc(T(D9.openDetective)) + "</a>";
  }
  div.innerHTML = h;
  trySec.parentNode.insertBefore(div, trySec.nextSibling);
  div.querySelectorAll("[data-w89open]").forEach(function(b){
    b.addEventListener("click", function(){
      w8Current = b.getAttribute("data-w89open"); w8Msg = ""; w8ConfirmReset = false;
      if (typeof closeLesson === "function") closeLesson();
      renderW8();
      /* Step 7: while the router is on, the studio lives in its own
         view — route there so the router shows that view (a manual
         scroll cannot reach a [hidden] subtree). The route is set on
         the same 150 ms delay openGlossaryFor uses, because
         closeLesson() first pops the lesson's history entry
         (history.back()); navigating immediately would race that
         traversal and lose. Router off, or already on the studio
         view: the original scroll below. */
      if (window.VARouter && window.VARouter.started && window.VARouter.currentView !== "view-writing-studio"){
        setTimeout(function(){ window.VARouter.navigate("/writing-studio"); }, 150);
        return;
      }
      setTimeout(function(){ var s = $("writingstudio"); if (s) s.scrollIntoView({ block: "start" }); }, 60);
    });
  });
  div.querySelectorAll("[data-w89det]").forEach(function(a){
    a.addEventListener("click", function(ev){
      if (typeof closeLesson === "function") closeLesson();
      /* Step 7: while the router is on, the detective lives in its
         own view — route there on the same 150 ms delay the Writing
         Studio button uses (a bare anchor jump races closeLesson()'s
         history.back() pop and loses). Router off, or already on the
         detective view: the original behavior — the anchor's own
         jump lands on the section. */
      if (window.VARouter && window.VARouter.started && window.VARouter.currentView !== "view-source-detective"){
        if (ev && ev.preventDefault) ev.preventDefault();
        setTimeout(function(){ window.VARouter.navigate("/source-detective"); }, 150);
      }
    });
  });
}
(function(){
  if (typeof fillModal === "function"){
    var prevFill = fillModal;
    fillModal = function(i, k){ var r = prevFill.apply(this, arguments); try { fx89OnLesson(i); } catch(e){} return r; };
  }
})();
/* ---------------- language + lifecycle ---------------- */
function refreshHeads89(){
  [secW, secD].forEach(function(s){
    if (!s || !s._head) return;
    s.querySelector(".w89-eyebrow").textContent = T(s._head.e);
    s.querySelector("h2").textContent = T(s._head.t);
    s.querySelector(".w89-secsub").textContent = T(s._head.s);
  });
  navLinks89.forEach(function(a){ a.textContent = T(a._pair); });
}
var renderTimer89 = null;
function renderAll89(){
  if (renderTimer89) return;
  renderTimer89 = setTimeout(function(){
    renderTimer89 = null;
    /* capture in-progress text before re-render so a language switch
       never loses learner writing */
    try {
      var e = w8Entry();
      var n = $("w8Notes"); if (n) e.evidenceNotes = n.value;
      secW.querySelectorAll("[data-w8plan]").forEach(function(ta){ e.plan[ta.getAttribute("data-w8plan")] = ta.value; });
      var dr = $("w8Draft"); if (dr && !e.firstDraftSavedAt) e.firstDraft = dr.value;
      var rv = $("w8Rev"); if (rv) e.revisionDraft = rv.value;
      var p = d9Entry();
      var df = $("d9Diff"); if (df) p.difference = df.value;
      var rp = $("d9Resp"); if (rp){ p.response = rp.value; d9SyncCitations(); }
    } catch(err){}
    try { refreshHeads89(); } catch(err){}
    try { renderW8(); } catch(err){}
    try { renderD9(); } catch(err){}
    try { refreshToday89(); } catch(err){}
  }, 40);
}
/* Language switches go through this feature's EXISTING update path
   (renderAll89, which captures in-progress drafts before re-rendering) —
   never through re-initialization. Chained onto setLang like every other
   feature wrapper, so a switch localizes Source Detective and Writing
   Studio even when another feature's step has completed. */
if (typeof setLang === "function"){
  var fx89PrevSetLang = setLang;
  setLang = function(l){
    var r = fx89PrevSetLang.apply(this, arguments);
    try { renderAll89(); } catch(e){}
    return r;
  };
}
["langEn", "langZh", "langBi"].forEach(function(id){
  var b = $(id);
  if (b) b.addEventListener("click", function(){ setTimeout(renderAll89, 90); });
});
window.addEventListener("storage", function(ev){
  if (!ev || !ev.key) return;
  if (ev.key === store8.key || ev.key === store9.key){ reloadStores(); renderAll89(); }
});
window.addEventListener("pagehide", function(){
  try { if (!store8.broken) store8.save(); } catch(e){}
  try { if (!store9.broken) store9.save(); } catch(e){}
});
document.addEventListener("visibilitychange", function(){ if (!document.hidden) renderAll89(); });
renderAll89();
})();
