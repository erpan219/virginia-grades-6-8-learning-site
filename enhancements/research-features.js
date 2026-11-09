/* =====================================================================
   FX5 — Five research-ranked features for VA Learning Ladder
   F07 Bilingual Bridge Mode · F02 Guided Practice (worked → completion
   → independent) · F04 Five-Minute Mixed Retrieval · F17 Parent
   Briefing · F11 Session Builder.
   Rules honored throughout: NEW localStorage keys only (logical va*
   keys, so the profile boot shim namespaces them per learner exactly
   like every other feature); existing progress, FSRS/SRS state, exam
   state and Today's Path are read, never rewritten — except the one
   intentional write F04 makes through the site's own srsApply/srsSave
   when a learner rates the daily flashcard. Every new string exists
   in English and Simplified Chinese. Workbook theme tokens only.
   ===================================================================== */
(function(){
"use strict";
if (typeof LESSONS === "undefined" || !document.body) return;
function $(id){ return document.getElementById(id); }
function fxEsc(s){ return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;"); }
function fxL(){ return (typeof lang !== "undefined") ? lang : "en"; }
function fxLi(){ return fxL() === "zh" ? 1 : 0; }
function fxIsBi(){ return fxL() === "bi"; }
/* pair = [en, zh]; text follows the site rule: zh mode → zh, bi → "en · zh" */
function fxT(pair){ if (!pair) return ""; if (fxL() === "zh") return pair[1] || pair[0] || ""; if (fxIsBi()) return (pair[0] || "") + " · " + (pair[1] || ""); return pair[0] || ""; }
function fxH(pair){ if (!pair) return ""; if (fxIsBi()) return fxEsc(pair[0] || "") + "<span class='bi-sub'>" + fxEsc(pair[1] || "") + "</span>"; return fxEsc(fxL() === "zh" ? (pair[1] || pair[0] || "") : (pair[0] || "")); }
function fxS(en, zh){ return fxT([en, zh]); }
function fxFill(tpl, map){ return String(tpl).replace(/\{(\w+)\}/g, function(m, k){ return (map && map[k] != null) ? map[k] : m; }); }
function fxGet(key, fb){ try { var r = window.localStorage.getItem(key); if (r == null) return fb; var v = JSON.parse(r); return (v && typeof v === "object") ? v : fb; } catch(e){ return fb; } }
function fxSet(key, val){ try { window.localStorage.setItem(key, JSON.stringify(val)); return true; } catch(e){ return false; } }
function fxToday(){ return (typeof srsDateStr === "function") ? srsDateStr(0) : (function(){ var d = new Date(); function p(n){ return (n < 10 ? "0" : "") + n; } return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); })(); }
function fxDateOf(dayStr){ try { return new Date(dayStr + "T12:00:00").toLocaleDateString(fxL() === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "long", day: "numeric" }); } catch(e){ return dayStr; } }
function fxDateTimeOf(iso){ try { var d = new Date(iso); return d.toLocaleDateString(fxL() === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "long", day: "numeric" }); } catch(e){ return ""; } }
function fxLearner(){
  try {
    var reg = (window.VAProfiles && typeof VAProfiles.readReg === "function") ? VAProfiles.readReg() : null;
    if (reg && typeof reg === "object"){
      for (var i = 0; i < reg.profiles.length; i++) if (reg.profiles[i].id === reg.activeProfileId) return { id: reg.profiles[i].id, name: reg.profiles[i].displayName || "" };
    }
  } catch(e){}
  return { id: "default", name: fxS("Learner", "学习者") };
}
function fxLessonTitle(lid){ var L = LESSONS[lid]; return L ? fxT(L.t) : ""; }
function fxOpenLesson(lid){ if (typeof openLesson === "function") openLesson(lid); }
function fxScrollTo(id){ var el = $(id); if (el) el.scrollIntoView({ behavior: (typeof reducedMotion !== "undefined" && reducedMotion) ? "auto" : "smooth", block: "start" }); }
/* Step 8: land on the flashcards. While the router is on they live in
   their own view, so route through #/flashcards first (the router
   shows the view) and scroll once it is on screen; a bare
   scrollIntoView would aim at a [hidden] view and land nowhere. With
   the router off this is exactly fxScrollTo("flash"). The route
   activation itself starts no session and rates nothing — any deck
   state was set by the caller's own clicks before this landing. */
function fxGoFlash(){
  if (window.VARouter && window.VARouter.started && window.VARouter.currentView !== "view-flashcards"){
    window.VARouter.navigate("/flashcards");
    setTimeout(function(){ fxScrollTo("flash"); }, 160);
  } else fxScrollTo("flash");
}
/* Step 11: land on Today's Path. While the router is on it lives in
   the home view (the Daily Review view's "Back to Today's Path"
   button is the caller), so route through #/home first and scroll
   once the view is on screen; with the router off this is exactly
   fxScrollTo("today"). The route activation itself changes no
   state — the caller has already set the review mode it returns
   from before this landing runs. */
function fxGoToday(){
  if (window.VARouter && window.VARouter.started && window.VARouter.currentView !== "view-home"){
    window.VARouter.navigate("/home");
    setTimeout(function(){ fxScrollTo("today"); }, 160);
  } else fxScrollTo("today");
}

/* ---------------- styles (workbook tokens only) ---------------- */
var css = document.createElement("style");
css.textContent = [
".fx-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-lg);padding:1.1rem 1.2rem;margin:0 0 1rem}",
".fx-card h3{margin:0 0 .4rem;font-size:1.12rem}",
".fx-sub{color:var(--ink-soft);margin:.2rem 0 .8rem}",
".fx-row{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}",
".fx-chipbtn{border:1px solid var(--boundary);background:var(--card);color:var(--ink);border-radius:999px;padding:.5rem .95rem;font-weight:700;font-size:.95rem;min-height:44px}",
".fx-chipbtn[aria-pressed='true']{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}",
".fx-chipbtn[aria-checked='true']{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}",
".fx-note{font-size:.9rem;color:var(--ink-soft)}",
".fx-status{font-size:.85rem;font-weight:700;border-radius:999px;padding:.15rem .6rem;background:var(--card-2);color:var(--ink-soft);white-space:nowrap}",
".fx-status.done{background:var(--good-bg);color:var(--good)}",
".fx-status.unavail{background:var(--bad-bg);color:var(--bad)}",
".fx-slot{display:flex;gap:.8rem;align-items:flex-start;border-top:1px dashed var(--line);padding:.8rem 0}",
".fx-slot:first-of-type{border-top:none}",
".fx-slot .fx-slot-body{flex:1;min-width:0}",
".fx-opt{display:block;width:100%;text-align:left;margin:.4rem 0;padding:.7rem .9rem;border:1px solid var(--boundary);border-radius:var(--r-md);background:var(--card);font-size:1rem;min-height:48px}",
".fx-opt.right{background:var(--good-bg);border-color:var(--good)}",
".fx-opt.wrong{background:var(--bad-bg);border-color:var(--bad)}",
".fx-opt:disabled{opacity:.85;cursor:default}",
".fx-fb{border-radius:var(--r-md);padding:.7rem .9rem;margin:.6rem 0;font-size:.98rem}",
".fx-fb.ok{background:var(--good-bg)}",
".fx-fb.no{background:var(--bad-bg)}",
".fx-input{width:100%;max-width:22rem;padding:.65rem .8rem;font-size:1.05rem;border:1px solid var(--boundary);border-radius:var(--r-sm);background:var(--card);color:var(--ink)}",
".fx-textarea{width:100%;min-height:6.5rem;padding:.7rem .9rem;font-size:1rem;border:1px solid var(--boundary);border-radius:var(--r-sm);background:var(--card);color:var(--ink);font-family:inherit}",
".fx-steps{display:flex;gap:.4rem;flex-wrap:wrap;margin:.4rem 0 .8rem}",
".fx-step{border:1px solid var(--boundary);border-radius:999px;padding:.3rem .8rem;font-size:.88rem;font-weight:700;color:var(--ink-soft);background:var(--card)}",
".fx-step.cur{border-color:var(--accent);color:var(--accent)}",
".fx-step.done{background:var(--good-bg);color:var(--good);border-color:var(--good)}",
".fx-worked-step{border-left:3px solid var(--accent);padding:.45rem .8rem;margin:.55rem 0;background:var(--card-2);border-radius:0 var(--r-sm) var(--r-sm) 0}",
".fx-langtag{display:inline-block;font-size:.72rem;font-weight:800;letter-spacing:.04em;border:1px solid var(--boundary);border-radius:4px;padding:.05rem .35rem;margin-right:.45rem;color:var(--ink-soft);vertical-align:.12em}",
".fx-zhblock{margin:.45rem 0;padding:.6rem .8rem;background:var(--card-2);border-radius:var(--r-sm)}",
".fx-revealbtn{border:none;background:none;color:var(--accent);font-weight:700;font-size:.9rem;padding:.3rem .2rem;text-decoration:underline;text-underline-offset:3px;min-height:36px}",
"html[data-theme='dark'] .fx-revealbtn{color:#A5C5A5}",
".fx-cardlink{display:inline-block;margin-top:.4rem;border:none;background:none;padding:.2rem 0;min-height:32px;color:var(--ink-soft);font-size:.82rem;font-weight:600;text-decoration:underline;text-underline-offset:3px;cursor:pointer}",
".fx-cardlink:hover,.fx-cardlink:focus-visible{color:var(--accent)}",
".fx-bridgebar{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin:.55rem 0 .2rem}",
".m-sec.fx-zh-off .bi-sub{display:none}",
".fx-drawer-back{position:fixed;inset:0;background:rgba(20,24,18,.45);z-index:120;display:none}",
".fx-drawer-back.open{display:block}",
".fx-drawer{position:fixed;top:0;right:0;height:100%;width:min(26rem,94vw);background:var(--bg);color:var(--ink);z-index:121;box-shadow:var(--shadow-lg);padding:1.1rem 1.2rem;overflow-y:auto;transform:translateX(105%);transition:transform .25s ease}",
".fx-drawer.open{transform:none}",
"@media (prefers-reduced-motion: reduce){.fx-drawer{transition:none}}",
"@media (max-width:640px){.fx-drawer{top:auto;bottom:0;left:0;right:0;width:auto;height:min(78vh,44rem);border-radius:16px 16px 0 0;transform:translateY(105%)}.fx-drawer.open{transform:none}}",
".fx-term{border-top:1px dashed var(--line);padding:.8rem 0}",
".fx-term:first-of-type{border-top:none}",
".fx-term .fx-term-en{font-weight:800;font-size:1.05rem}",
".fx-hearbtn{flex:none;display:inline-grid;place-items:center;width:34px;height:34px;padding:0;border:0;border-radius:8px;background:transparent;color:inherit;opacity:.55;cursor:pointer;transition:opacity 140ms ease-out}",
".fx-hearbtn svg{width:20px;height:20px;display:block}",
".fx-hearbtn:hover,.fx-hearbtn:focus-visible,.fx-hearbtn:active{opacity:1}",
".fx-hearbtn:focus-visible{outline:2px solid currentColor;outline-offset:2px}",
".fx-hearbtn.fx-speaking{opacity:1;color:var(--accent)}",
".fx-bridge-group{border-top:1px solid rgba(244,239,221,.25);padding-top:.6rem;margin-top:.6rem}",
".fx-bridge-group .fx-bg-label{font-weight:800;font-size:.9rem;margin:0 0 .4rem}",
".fx-bridge-opt{display:block;width:100%;text-align:left;background:none;border:1px solid rgba(244,239,221,.4);color:inherit;border-radius:var(--r-sm);padding:.5rem .7rem;margin:.35rem 0;font-size:.92rem}",
".fx-bridge-opt[aria-checked='true']{background:rgba(244,239,221,.16);border-color:#e9b949}",
".fx-bridge-opt small{display:block;opacity:.85;font-weight:400}",
".fx-setcard{background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:var(--r-lg);padding:1rem 1.1rem;margin:.8rem 0}",
".fx-setcard .fx-bridge-opt{border-color:var(--boundary);color:var(--ink)}",
".fx-setcard .fx-bridge-opt[aria-checked='true']{background:var(--gold-soft);border-color:var(--accent)}",
".fx-today-grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr));margin-top:1rem}",
".fx-ev{border:1px solid var(--line);border-radius:var(--r-md);padding:.8rem .95rem;margin:.55rem 0;background:var(--card)}",
".fx-ev .fx-ev-date{font-size:.85rem;color:var(--ink-faint);font-weight:700}",
".fx-bigbtn{display:inline-flex;align-items:center;gap:.5rem;min-height:48px}",
".fx-prog{font-weight:800}",
".fx-sess-item{display:flex;gap:.8rem;align-items:flex-start;border:1px solid var(--line);border-radius:var(--r-md);padding:.85rem .95rem;margin:.55rem 0;background:var(--card)}",
".fx-sess-num{flex:none;width:1.9rem;height:1.9rem;border-radius:50%;background:var(--accent);color:var(--accent-ink);font-weight:800;display:flex;align-items:center;justify-content:center}",
".fx-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}",
"#soleexam.fx-exam-gate .bi-sub,#solstyle.fx-exam-gate .bi-sub{display:none}",
"@media print{.fx-drawer,.fx-drawer-back{display:none!important}}"
].join("\n");
document.head.appendChild(css);

/* ---------------- string catalogs (from the five detail plans) ---------------- */
var FX = {
bridge: {
  label: ["Language mode", "语言模式"],
  settingsHeading: ["Reading & practice", "阅读与练习"],
  supportName: ["English with Chinese support", "英文为主，中文辅助"],
  supportDesc: ["Read in English. Show Chinese when you need it.", "阅读英文；需要时显示中文。"],
  parallelName: ["Side-by-side reading", "英中对照阅读"],
  parallelDesc: ["Read English and Chinese together.", "对照阅读英文和中文。"],
  practiceName: ["English-first practice", "英文优先练习"],
  practiceDesc: ["Try practice in English before seeing Chinese.", "先用英文练习，再查看中文。"],
  currentMode: ["Language mode: {mode}", "语言模式：{mode}"],
  showChinese: ["Show Chinese", "显示中文"],
  hideChinese: ["Hide Chinese", "隐藏中文"],
  englishLabel: ["EN", "英文"],
  chineseLabel: ["简体中文", "简体中文"],
  afterItem: ["Chinese is available after you submit this question.", "提交本题后可查看中文。"],
  afterExam: ["Chinese is available after you submit the exam.", "提交整份考试后可查看中文。"],
  unavailable: ["Reviewed Chinese is not available for this content.", "此内容暂无经审核的中文。"],
  unsaved: ["Your language mode could not be saved on this device.", "无法在此设备上保存语言模式。"]
},
terms: {
  open: ["Term deck", "术语卡组"],
  title: ["Terms for {lessonTitle}", "{lessonTitle}的术语"],
  count: ["{count} terms", "{count} 个术语"],
  close: ["Close term deck", "关闭术语卡组"],
  hear: ["Hear English", "听英文发音"],
  stop: ["Stop pronunciation", "停止播放发音"],
  speechUnavailable: ["English pronunciation is unavailable on this device.", "此设备无法播放英文发音。"],
  noTerms: ["No reviewed terms are available for this lesson.", "本课暂无经审核的术语。"],
  reviewCard: ["Review in Flashcards", "复习单词卡"]
},
f02: {
  title: ["Guided practice", "引导练习"],
  description: ["See how it works, finish an example, then try one yourself.", "先看解题过程，再完成例题，最后独立尝试。"],
  continue: ["Continue guided practice", "继续引导练习"],
  start: ["Start guided practice", "开始引导练习"],
  stageWorked: ["Worked example", "完整例题"],
  stageCompletion: ["Complete an example", "补全例题"],
  stageIndependent: ["Try independently", "独立尝试"],
  notStarted: ["Not started", "未开始"],
  inProgress: ["In progress", "进行中"],
  completed: ["Completed", "已完成"],
  currentStage: ["Current stage", "当前阶段"],
  progress: ["Stage {current} of 3", "第 {current} 阶段，共 3 阶段"],
  predict: ["What should happen next?", "下一步应该怎么做？"],
  predictionLabel: ["Your prediction", "你的预测"],
  missingStepLabel: ["Enter the missing step", "填写缺少的步骤"],
  answerLabel: ["Your answer", "你的答案"],
  submitPrediction: ["Check prediction", "检查预测"],
  submitStep: ["Check step", "检查步骤"],
  submitAnswer: ["Check answer", "检查答案"],
  revealStep: ["Show this step", "显示这一步"],
  nextStep: ["Next step", "下一步"],
  correct: ["That's correct.", "答对了。"],
  incorrect: ["Not yet. Review the step, then try another example.", "还不对。先看这一步，再试另一道例题。"],
  empty: ["Enter a response before checking.", "请先输入答案再检查。"],
  workedComplete: ["You predicted every step. Ready to complete an example.", "你预测对了每一步。可以试着补全例题了。"],
  completionComplete: ["You completed the example. Ready to try independently.", "你补全了例题。可以独立尝试了。"],
  independentComplete: ["You solved it independently.", "你独立解出了这道题。"],
  nextStage: ["Continue to next stage", "进入下一阶段"],
  tryAgain: ["Try a new problem", "换一道题再试"],
  studyAgain: ["Review a worked example", "再看一道完整例题"],
  explanation: ["Explanation", "解析"],
  supportRule: ["Complete this stage without revealing an answer to unlock the next stage.", "不查看答案并完成本阶段，即可解锁下一阶段。"],
  goLearn: ["Return to Learn", "返回“学习”"],
  goTry: ["Continue to Try", "继续“尝试”"],
  choose: ["Choose what to practice:", "选择要练习的内容："],
  nextConcept: ["Practice another concept", "练习另一个知识点"],
  openLesson: ["Open the lesson", "打开课程"],
  unavailable: ["Guided practice is unavailable for this lesson.", "本课暂无引导练习。"],
  contentUpdated: ["This practice has been updated. Start this stage again; your lesson progress is safe.", "本练习已更新。请重新开始本阶段；你的课程进度不会丢失。"],
  saveFailed: ["Progress could not be saved on this device. You can continue, but it may not be here when you return.", "无法在此设备上保存进度。你可以继续，但下次返回时进度可能不在。"]
},
mixed: {
  title: ["Five-Minute Mixed Retrieval", "五分钟混合回顾"],
  nav: ["Daily Review", "每日回顾"],
  description: ["Review a flashcard, a missed problem, an older skill, and an explanation. About five minutes; no timer.", "回顾一张闪卡、一道曾做错的题、一项较早学过的技能，并完成一道解释题。约五分钟；不计时。"],
  progress: ["{done} of {available} available activities done", "已完成 {available} 项可做活动中的 {done} 项"],
  savedLocally: ["Saved on this device for {learner}.", "已为学习者{learner}保存在此设备上。"],
  start: ["Start review", "开始回顾"],
  continue: ["Continue review", "继续回顾"],
  resultsAction: ["View results", "查看结果"],
  exit: ["Save and exit", "保存并退出"],
  next: ["Next activity", "下一项活动"],
  position: ["Activity {current} of 4", "第 {current} 项，共 4 项"],
  slotFlashcard: ["Due flashcard", "到期闪卡"],
  slotMissed: ["Previously missed problem", "曾做错的题"],
  slotOlder: ["Older skill", "较早学过的技能"],
  slotExplain: ["Explain a skill", "解释一项技能"],
  ready: ["Ready", "可以开始"],
  done: ["Done", "已完成"],
  unavailable: ["Unavailable today", "今天暂无内容"],
  source: ["From {lesson}: {skill}", "来自{lesson}：{skill}"],
  check: ["Check answer", "检查答案"],
  correct: ["Correct.", "回答正确。"],
  incorrect: ["Not quite. Review the worked solution.", "还不完全正确。请查看解题过程。"],
  solution: ["Worked solution", "解题过程"],
  reveal: ["Show answer", "显示答案"],
  ratingHelp: ["How well did you recall it? This updates the flashcard's review schedule.", "你回忆得怎么样？此评价会更新闪卡的复习时间。"],
  again: ["Again", "重来"],
  hard: ["Hard", "困难"],
  good: ["Good", "良好"],
  easy: ["Easy", "简单"],
  explainInstruction: ["Explain your thinking in your own words. You will compare it with a reference explanation.", "用自己的话解释你的思路，然后与参考解释比较。"],
  explainPlaceholder: ["Write your explanation here", "在此写下你的解释"],
  showReference: ["Compare explanations", "对照解释"],
  reference: ["Reference explanation", "参考解释"],
  selfCheck: ["Did your explanation include the important idea?", "你的解释包含关键思路吗？"],
  met: ["Met it", "已包含"],
  needsWork: ["Needs work", "还需练习"],
  unFlashcard: ["No flashcards are due today.", "今天没有到期闪卡。"],
  unMissed: ["No earlier missed application problems are available yet.", "目前还没有可回顾的曾做错应用题。"],
  unOlder: ["No eligible older skill is available yet.", "目前还没有符合条件的较早技能。"],
  unExplain: ["No explanation prompt is available for a studied skill yet.", "已学技能目前还没有可用的解释题。"],
  resultsTitle: ["Today's review", "今日回顾"],
  partialResult: ["You finished all available activities. Unavailable slots were not counted.", "你已完成所有可做的活动；暂无内容的项目未计入。"],
  fullResult: ["You finished today's four activities.", "你已完成今天的四项活动。"],
  noActivities: ["Nothing is available for today's set. Keep learning and check again tomorrow.", "今日回顾暂无可做内容。继续学习，明天再来看看。"],
  backPath: ["Return to Today's Path", "返回今日路径"],
  reviewLesson: ["Review {lesson}", "回顾{lesson}"],
  missingItem: ["This activity is no longer available. It will not count against your progress.", "此活动已不可用，不会影响你的进度。"],
  saveError: ["Could not save on this device. Free up browser storage, then try again. Your answer has not been submitted.", "无法保存在此设备上。请清理浏览器存储空间后重试；你的答案尚未提交。"],
  loadError: ["Today's review could not be loaded. Your other progress has not been changed.", "无法加载今日回顾；你的其他学习进度未被更改。"],
  answerRequired: ["Enter an answer before checking it.", "请先输入答案，再检查。"],
  explanationRequired: ["Write an explanation before comparing.", "请先写下解释，再进行对照。"]
},
brief: {
  nav: ["Parent Briefing", "家长简报"],
  title: ["Parent Briefing", "家长简报"],
  eyebrow: ["For Families · Parent Briefing", "给家长 · 家长简报"],
  forLearner: ["For {learner}", "学习者：{learner}"],
  asOf: ["Updated {date}", "更新于{date}"],
  localNotice: ["Based on learning activity saved on this device.", "根据保存在此设备上的学习活动生成。"],
  evHeading: ["Evidence of learning", "学习记录"],
  evIntro: ["Here are a few recent things you can point to. Activity is not the same as mastery.", "以下是近期几项可供参考的学习记录。完成活动不等于掌握知识。"],
  evCheck: ["In Check for {activity}, {learner} got {result}.", "在“{activity}”的“检查”环节，{learner}的结果是{result}。"],
  evExam: ["In {activity}, {learner} got {result}.", "在“{activity}”中，{learner}的结果是{result}。"],
  evCompleted: ["{learner} completed {activity}. No scored result is recorded here.", "{learner}完成了“{activity}”。这里没有记录评分结果。"],
  evReviewed: ["{learner} reviewed {count} flashcards in {activity}. This records practice, not mastery.", "{learner}在“{activity}”中复习了{count}张闪卡。这是练习记录，并不表示已掌握。"],
  evNoScore: ["No score recorded", "未记录分数"],
  evEmpty: ["There isn't learning activity to show for this learner yet.", "此学习者目前还没有可显示的学习活动。"],
  evLimited: ["Some older activity cannot be shown because it does not identify a learner, activity, or date reliably.", "部分较早的活动记录无法可靠地确定学习者、活动或日期，因此未予显示。"],
  nextHeading: ["One next step", "下一步做一件事"],
  nextIntro: ["A practical suggestion based on what is recorded here.", "根据这里记录的活动给出的一项可行建议。"],
  nextRetryCheck: ["Revisit {activity}, then try its Check again.", "回顾“{activity}”，然后再做一次“检查”。"],
  nextRetryCheckWhy: ["The latest recorded Check suggests this is worth another try.", "最近一次“检查”记录表明，这项内容值得再试一次。"],
  nextReviewCards: ["Review the flashcards due in {activity}.", "复习“{activity}”中到期的闪卡。"],
  nextReviewCardsWhy: ["{count} cards are due for review.", "有{count}张闪卡到了复习时间。"],
  nextFinishLesson: ["Continue {activity} at {result}.", "从{result}继续学习“{activity}”。"],
  nextFinishLessonWhy: ["This lesson has a recorded next stage.", "这节课还有下一环节。"],
  nextTryPractice: ["Try {activity}.", "试做“{activity}”。"],
  nextTryPracticeWhy: ["This is an available practice activity for the learner's grade.", "这是一项适合该学习者年级的练习活动。"],
  nextStartPath: ["Start with Today's Path.", "从“今日学习路径”开始。"],
  nextStartPathWhy: ["There isn't enough recorded activity for a more specific suggestion yet.", "目前的活动记录还不足以给出更具体的建议。"],
  openLesson: ["Open lesson", "打开课程"],
  openFlashcards: ["Review flashcards", "复习闪卡"],
  openPractice: ["Open practice", "打开练习"],
  openPath: ["Open Today's Path", "打开今日学习路径"],
  convHeading: ["Talk about it", "聊一聊"],
  convIntro: ["You do not need to know the answer. Ask your learner to explain their thinking.", "您不需要知道答案。请让孩子说说自己的想法。"],
  convExplain: ["“What is one idea from {activity} you could explain in your own words?”", "“你能用自己的话解释‘{activity}’中的一个知识点吗？”"],
  convChallenge: ["“Which part of {activity} felt tricky, and what might you try differently?”", "“你觉得‘{activity}’的哪一部分比较难？下次想换什么方法试试？”"],
  convReview: ["“How would you help someone remember an idea from {activity}?”", "“如果要帮别人记住‘{activity}’中的一个知识点，你会怎么做？”"],
  convGeneric: ["“What did you learn or wonder about today?”", "“你今天学到了什么，或者有什么好奇的问题？”"],
  footer: ["This briefing reflects activity available on this device. It is not a grade report or a prediction.", "本简报仅反映此设备上可用的活动记录，不是成绩报告，也不是预测。"],
  unavailable: ["This activity is no longer available. Choose another activity from Today's Path.", "这项活动已无法打开。请从“今日学习路径”选择其他活动。"],
  loading: ["Preparing briefing…", "正在生成简报…"],
  error: ["The briefing could not be prepared from saved activity. Your progress has not been changed.", "无法根据已保存的活动生成简报。您的学习进度未被更改。"],
  retry: ["Try again", "重试"]
},
sess: {
  nav: ["Session Builder", "学习计划"],
  todayAction: ["Build a session", "制定学习计划"],
  title: ["Build your session", "制定你的学习计划"],
  eyebrow: ["Plan Your Time · Session Builder", "规划时间 · 学习计划"],
  intro: ["Choose what fits your time and energy. You can stop at any point.", "根据你的时间和精力来选择。你可以随时停止。"],
  timeLabel: ["Available time", "可用时间"],
  minuteChoice: ["{count} min", "{count} 分钟"],
  energyLabel: ["Energy", "精力状态"],
  energyLow: ["Low", "较低"],
  energyMedium: ["Medium", "适中"],
  energyHigh: ["High", "充沛"],
  focusLabel: ["Focus", "学习重点"],
  focusBalanced: ["Balanced", "均衡安排"],
  focusLearn: ["Learn", "学习新内容"],
  focusPractice: ["Practice", "练习"],
  focusReview: ["Review", "复习"],
  estimateNote: ["Times are estimates, not a timer. Your activity progress is saved as usual.", "时间仅供参考，不是倒计时。学习进度会照常保存。"],
  build: ["Build plan", "制定计划"],
  planTitle: ["Your session plan", "你的学习计划"],
  estimatedTotal: ["Estimated: {minutes} of {budget} min", "预计：{minutes} 分钟，共可用 {budget} 分钟"],
  itemNumber: ["Item {current} of {total}", "第 {current} 项，共 {total} 项"],
  itemEstimate: ["About {minutes} min", "约 {minutes} 分钟"],
  cardCount: ["{count} due cards", "{count} 张待复习卡片"],
  flashcards: ["Flashcard review", "复习卡片"],
  typeLearn: ["Learn", "学习"],
  typeTry: ["Try", "尝试"],
  typeCheck: ["Check", "检查"],
  typeReview: ["Review", "复习"],
  reasonDue: ["Due for review", "已到复习时间"],
  reasonContinue: ["Continue a lesson", "继续一节课"],
  reasonStart: ["Start a lesson", "开始一节课"],
  start: ["Start session", "开始学习"],
  change: ["Change choices", "更改选择"],
  backToday: ["Back to Today's Path", "返回今日学习路线"],
  emptyTitle: ["No activities fit these choices yet", "暂时没有符合这些选择的活动"],
  emptyBody: ["Try more time, a different focus or energy level, or explore Today's Path.", "试试增加时间、更换学习重点或精力状态，或者查看今日学习路线。"],
  resume: ["Resume session", "继续学习计划"],
  newPlan: ["Start a new plan", "制定新计划"],
  replaceConfirm: ["Replace this session plan? Your lesson and flashcard progress will stay saved.", "要替换当前学习计划吗？课程和卡片的学习进度仍会保留。"],
  replace: ["Replace plan", "替换计划"],
  cancel: ["Cancel", "取消"],
  open: ["Open activity", "打开学习活动"],
  continueAct: ["Continue activity", "继续学习活动"],
  done: ["Mark done", "标记完成"],
  skip: ["Skip item", "跳过此项"],
  stop: ["Stop session", "结束学习计划"],
  back: ["Back to session", "返回学习计划"],
  elapsed: ["Active time: {minutes} min", "已学习：{minutes} 分钟"],
  timeReached: ["Time reached—finish here or keep working.", "已达到预定时间——可以在这里结束，也可以继续。"],
  completeTitle: ["Session finished", "学习计划已结束"],
  completeCount: ["{done} done · {skipped} skipped", "已完成 {done} 项 · 已跳过 {skipped} 项"],
  buildAnother: ["Build another session", "制定另一个学习计划"],
  unavailable: ["This activity is no longer available. Choose another plan.", "此活动目前无法继续。请制定其他计划。"],
  storageError: ["This device could not save the session plan. Your existing learning progress was not changed.", "此设备无法保存学习计划。已有的学习进度未受影响。"]
}
};

/* ---------------- scaffolding: nav, sections, today extras ---------------- */
function fxSec(id, eyebrowPair, titlePair, subPair, labelledBy){
  var s = document.createElement("section");
  s.className = "block"; s.id = id; s.setAttribute("aria-labelledby", labelledBy);
  s.innerHTML = "<div class='sec-head'><div><p class='eyebrow fx-eyebrow'></p><h2 id='" + labelledBy + "'></h2><p class='fx-sub fx-secsub'></p></div></div><div class='fx-host'></div>";
  s.querySelector(".fx-eyebrow").textContent = fxT(eyebrowPair);
  s.querySelector("h2").textContent = fxT(titlePair);
  s.querySelector(".fx-secsub").textContent = fxT(subPair);
  s._fxHead = { eyebrow: eyebrowPair, title: titlePair, sub: subPair };
  return s;
}
var fxTodaySec = $("today");
var secMixed = fxSec("dailyreview", ["Daily Review · Five Minutes", "每日回顾 · 五分钟"], FX.mixed.title, FX.mixed.description, "fxMixedH");
var secBrief = fxSec("briefing", FX.brief.eyebrow, FX.brief.title, FX.brief.localNotice, "fxBriefH");
var secSess = fxSec("sessionbuilder", FX.sess.eyebrow, FX.sess.title, FX.sess.intro, "fxSessH");
if (fxTodaySec && fxTodaySec.parentNode){
  fxTodaySec.parentNode.insertBefore(secMixed, fxTodaySec.nextSibling);
  secMixed.parentNode.insertBefore(secBrief, secMixed.nextSibling);
  secMixed.parentNode.insertBefore(secSess, secBrief.nextSibling);
}
[secMixed, secBrief, secSess].forEach(function(s){
  if (!s) return;
  var obsTarget = s;
  if ("IntersectionObserver" in window && obsTarget){
    new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.isIntersecting) fxRenderAll(); }); }, { threshold: 0.04 }).observe(obsTarget);
  }
});
/* nav links */
(function(){
  var tnav = document.querySelector(".tnav"); if (!tnav) return;
  function mk(href, pair){
    var a = document.createElement("a"); a.href = href; a.textContent = fxT(pair); a._fxPair = pair; return a;
  }
  var aMixed = mk("#dailyreview", FX.mixed.nav);
  var aBrief = mk("#briefing", FX.brief.nav);
  var aSess = mk("#sessionbuilder", FX.sess.nav);
  var rev = $("navReview"), tod = $("navToday");
  if (rev && rev.parentNode === tnav) tnav.insertBefore(aMixed, rev.nextSibling); else tnav.appendChild(aMixed);
  if (tod && tod.parentNode === tnav){ tnav.insertBefore(aBrief, tod.nextSibling); tnav.insertBefore(aSess, aBrief.nextSibling); }
  else { tnav.appendChild(aBrief); tnav.appendChild(aSess); }
  window.__fxNavLinks = [aMixed, aBrief, aSess];
})();
/* Today's Path extras: F04 card + F11 action + F02 in-progress link */
var fxTodayExtra = document.createElement("div");
fxTodayExtra.className = "fx-today-grid"; fxTodayExtra.id = "fxTodayExtra";
if (fxTodaySec) fxTodaySec.appendChild(fxTodayExtra);

/* =====================================================================
   F07 — Bilingual Bridge Mode
   A per-learner reading & practice preference, separate from the site
   language (vaLang.v1). Stored in the NEW key vaBridge.v1 (logical key:
   the profile shim namespaces it per learner). Modes:
   support  — lesson content stays in the site language; Chinese (or
              English, in Chinese mode) starts collapsed behind a
              per-block reveal.
   parallel — lesson content renders side-by-side (bilingual) while the
              lesson is open; the rest of the page keeps its language.
   practice — lesson content renders English-first while the lesson is
              open; Chinese for a quiz question appears only after that
              question is answered, and SOL exam Chinese stays hidden
              while an exam is in progress.
   ===================================================================== */
var BRIDGE_KEY = "vaBridge.v1";
var BRIDGE_MODES = ["support", "parallel", "practice"];
function fxBridgeMode(){
  var v = fxGet(BRIDGE_KEY, null);
  if (v && BRIDGE_MODES.indexOf(v.mode) >= 0) return v.mode;
  return "support"; /* plan default: English with Chinese support, collapsed */
}
function fxBridgeModePair(mode){
  return mode === "parallel" ? FX.bridge.parallelName : (mode === "practice" ? FX.bridge.practiceName : FX.bridge.supportName);
}
var fxBridgeSaveNote = "";
function fxSetBridgeMode(mode){
  if (BRIDGE_MODES.indexOf(mode) < 0) return;
  var ok = fxSet(BRIDGE_KEY, { version: 1, mode: mode });
  fxBridgeSaveNote = ok ? "" : fxT(FX.bridge.unsaved);
  fxRenderBridgeControls();
  fxApplyExamGate();
  var mb = $("modalBack");
  if (mb && mb.classList.contains("open") && typeof currentLesson !== "undefined" && currentLesson >= 0){
    /* re-render the open lesson under the new mode */
    fxBridgeRestoreLang();
    fxBridgeApplyLang();
    if (typeof fillModal === "function") fillModal(currentLesson, true);
  }
}
function fxBridgeOptionHtml(mode, checked){
  var name = mode === "parallel" ? FX.bridge.parallelName : (mode === "practice" ? FX.bridge.practiceName : FX.bridge.supportName);
  var desc = mode === "parallel" ? FX.bridge.parallelDesc : (mode === "practice" ? FX.bridge.practiceDesc : FX.bridge.supportDesc);
  return "<button type='button' class='fx-bridge-opt' role='radio' aria-checked='" + (checked ? "true" : "false") + "' data-fxbridge='" + mode + "'>" +
    fxEsc(fxT(name)) + "<small>" + fxEsc(fxT(desc)) + "</small></button>";
}
function fxBridgeGroupHtml(cls){
  var mode = fxBridgeMode();
  var h = "<div class='" + cls + "' role='radiogroup' aria-label='" + fxEsc(fxT(FX.bridge.label)) + "'>";
  h += "<p class='fx-bg-label'>" + fxEsc(fxT(FX.bridge.label)) + "</p>";
  BRIDGE_MODES.forEach(function(m){ h += fxBridgeOptionHtml(m, m === mode); });
  if (fxBridgeSaveNote) h += "<p class='fx-note' role='status'>" + fxEsc(fxBridgeSaveNote) + "</p>";
  return h + "</div>";
}
function fxRenderBridgeControls(){
  ["fxBridgeToolbar", "fxBridgeSettings"].forEach(function(id){
    var host = $(id); if (!host) return;
    host.innerHTML = (id === "fxBridgeSettings" ? "<h2 id='fxBridgeSettingsH'>" + fxEsc(fxT(FX.bridge.settingsHeading)) + "</h2>" : "") + fxBridgeGroupHtml(id === "fxBridgeToolbar" ? "fx-bridge-group" : "fx-setcard");
    host.querySelectorAll("[data-fxbridge]").forEach(function(b){
      b.addEventListener("click", function(){ fxSetBridgeMode(b.getAttribute("data-fxbridge")); });
    });
  });
}
/* toolbar control (beside the language toggle) + learner-settings control */
(function(){
  var panel = $("toolbarPanelBody");
  if (panel){
    var d = document.createElement("div"); d.id = "fxBridgeToolbar";
    var lt = panel.querySelector(".lang-toggle");
    if (lt && lt.parentNode === panel) panel.insertBefore(d, lt.nextSibling); else panel.appendChild(d);
  }
  var learners = $("learners");
  if (learners){
    var wrap = document.createElement("div"); wrap.id = "fxBridgeSettings";
    var head = document.createElement("h3"); head.textContent = fxT(FX.bridge.settingsHeading); head.id = "fxBridgeSettingsH";
    wrap.appendChild(head); learners.appendChild(wrap);
  }
})();
/* lesson bar: current mode chip + Term deck button (injected into the modal) */
(function(){
  var alt = $("mAlt"); if (!alt || !alt.parentNode) return;
  var bar = document.createElement("div"); bar.className = "fx-bridgebar"; bar.id = "fxLessonBar";
  bar.innerHTML = "<button type='button' class='btn btn-line' id='fxTermBtn'></button>";
  alt.parentNode.insertBefore(bar, alt.nextSibling);
  $("fxTermBtn").textContent = fxT(FX.terms.open);
  $("fxTermBtn").addEventListener("click", function(){ fxOpenTermDeck(); });
})();
/* content-language override while a lesson is open */
var fxLangSaved = null;
function fxBridgeApplyLang(){
  var mode = fxBridgeMode();
  var eff = mode === "parallel" ? "bi" : (mode === "practice" ? "en" : null);
  if (eff && typeof lang !== "undefined" && lang !== eff && fxLangSaved === null){
    fxLangSaved = lang;
    try { lang = eff; } catch(e){}
  }
}
function fxBridgeRestoreLang(){
  if (fxLangSaved !== null && typeof lang !== "undefined"){
    try { lang = fxLangSaved; } catch(e){}
    fxLangSaved = null;
    if (typeof applyI18n === "function") applyI18n();
    if (typeof renderLessons === "function") renderLessons();
  }
}
(function(){
  if (typeof openLesson === "function"){
    var prevOpen = openLesson;
    openLesson = function(i){ fxBridgeApplyLang(); var r = prevOpen.apply(this, arguments); return r; };
  }
  if (typeof closeLesson === "function"){
    var prevClose = closeLesson;
    closeLesson = function(){ var r = prevClose.apply(this, arguments); try { fxCloseTermDeck(); } catch(e){} fxBridgeRestoreLang(); return r; };
  }
})();
/* support-mode reveals + practice-mode post-answer Chinese, after each fill */
function fxBridgeAfterFill(lid){
  fxRenderBridgeControls();
  var L = LESSONS[lid]; if (!L) return;
  var mode = fxBridgeMode();
  var box = $("modalBox"); if (!box) return;
  if (mode === "support"){
    if (fxIsBi()){
      box.querySelectorAll(".m-sec").forEach(function(sec){
        if (!sec.querySelector(".bi-sub")) return;
        var existingTgl = sec.querySelector(".fx-sec-toggle");
        if (existingTgl){
          /* Language update: relabel the existing helper from the lookup,
             preserving which state (shown/hidden) it is in. */
          var zhOff = sec.classList.contains("fx-zh-off");
          existingTgl.textContent = fxT(zhOff ? FX.bridge.showChinese : FX.bridge.hideChinese);
          existingTgl.setAttribute("aria-expanded", zhOff ? "false" : "true");
          return;
        }
        sec.classList.add("fx-zh-off");
        var b = document.createElement("button"); b.type = "button"; b.className = "fx-revealbtn fx-sec-toggle va-helper-btn";
        b.textContent = fxT(FX.bridge.showChinese);
        b.setAttribute("aria-expanded", "false");
        b.addEventListener("click", function(){
          var off = sec.classList.toggle("fx-zh-off");
          b.textContent = fxT(off ? FX.bridge.showChinese : FX.bridge.hideChinese);
          b.setAttribute("aria-expanded", off ? "false" : "true");
        });
        sec.insertBefore(b, sec.firstChild);
      });
    } else {
      /* single-language rendering: offer the other language per block */
      var other = fxLi() === 0 ? 1 : 0;
      [["mIdea", L.d], ["mExample", L.ex], ["mTry", L["try"]]].forEach(function(spec){
        var el = $(spec[0]); if (!el || !spec[1] || !spec[1][other]) return;
        var sec = el.closest ? (el.closest(".m-sec") || el.parentElement) : el.parentElement;
        if (!sec) return;
        var existB = sec.querySelector(".fx-block-toggle");
        if (existB){
          /* Language update: rebuild the revealed block in the (new)
             other language and relabel the helper from the lookup,
             preserving its shown/hidden state. */
          var existZh = sec.querySelector(".fx-zhblock");
          if (existZh){
            existZh.innerHTML = "<span class='fx-langtag'>" + fxEsc(fxT(other === 1 ? FX.bridge.chineseLabel : FX.bridge.englishLabel)) + "</span>" + spec[1][other];
            existZh.setAttribute("lang", other === 1 ? "zh-Hans" : "en");
            existB.textContent = fxT(existZh.hidden ? (other === 1 ? FX.bridge.showChinese : ["Show English", "显示英文"]) : (other === 1 ? FX.bridge.hideChinese : ["Hide English", "隐藏英文"]));
            existB.setAttribute("aria-expanded", existZh.hidden ? "false" : "true");
          }
          return;
        }
        var wrap = document.createElement("div");
        var b = document.createElement("button"); b.type = "button"; b.className = "fx-revealbtn fx-block-toggle va-helper-btn";
        b.textContent = fxT(other === 1 ? FX.bridge.showChinese : ["Show English", "显示英文"]);
        b.setAttribute("aria-expanded", "false");
        var zh = document.createElement("div"); zh.className = "fx-zhblock"; zh.hidden = true;
        zh.setAttribute("lang", other === 1 ? "zh-Hans" : "en");
        zh.innerHTML = "<span class='fx-langtag'>" + fxEsc(fxT(other === 1 ? FX.bridge.chineseLabel : FX.bridge.englishLabel)) + "</span>" + spec[1][other];
        b.addEventListener("click", function(){
          var show = zh.hidden;
          zh.hidden = !show;
          var toZh = zh.getAttribute("lang") === "zh-Hans";
          b.textContent = fxT(show ? (toZh ? FX.bridge.hideChinese : ["Hide English", "隐藏英文"]) : (toZh ? FX.bridge.showChinese : ["Show English", "显示英文"]));
          b.setAttribute("aria-expanded", show ? "true" : "false");
        });
        wrap.appendChild(b); wrap.appendChild(zh);
        sec.appendChild(wrap);
      });
    }
  }
  if (mode === "practice"){
    var quiz = $("mQuiz");
    if (quiz && !quiz._fxPracticeBound){
      quiz._fxPracticeBound = true;
      quiz.addEventListener("click", function(){
        setTimeout(function(){ fxPracticeScan(lid); }, 60);
      });
    }
    fxPracticeScan(lid);
  }
}
function fxPracticeScan(lid){
  if (fxBridgeMode() !== "practice") return;
  var L = LESSONS[lid]; if (!L) return;
  var quiz = $("mQuiz"); if (!quiz) return;
  quiz.querySelectorAll(".quiz-q").forEach(function(boxEl, qi){
    var existingQzh = boxEl.querySelector(".fx-qzh");
    if (existingQzh){
      /* Language update: relabel the existing helper from the lookup,
         preserving its shown/hidden state. */
      var eb = existingQzh.querySelector(".fx-revealbtn"), ezh = existingQzh.querySelector(".fx-zhblock");
      if (eb && ezh) eb.textContent = fxT(ezh.hidden ? FX.bridge.showChinese : FX.bridge.hideChinese);
      var en = existingQzh.querySelector(".fx-note"); if (en) en.textContent = fxT(FX.bridge.afterItem);
      return;
    }
    var why = boxEl.querySelector(".why");
    if (!why || !why.classList.contains("show")) return;
    var q = L.q[qi]; if (!q) return;
    var wrap = document.createElement("div"); wrap.className = "fx-qzh";
    var note = document.createElement("p"); note.className = "fx-note"; note.textContent = fxT(FX.bridge.afterItem);
    var b = document.createElement("button"); b.type = "button"; b.className = "fx-revealbtn va-helper-btn";
    b.textContent = fxT(FX.bridge.showChinese); b.setAttribute("aria-expanded", "false");
    var zh = document.createElement("div"); zh.className = "fx-zhblock"; zh.hidden = true; zh.setAttribute("lang", "zh-Hans");
    zh.innerHTML = "<span class='fx-langtag'>" + fxEsc(fxT(FX.bridge.chineseLabel)) + "</span>" + fxEsc(q[1] || "") +
      "<br>" + fxEsc(q[5] || "");
    b.addEventListener("click", function(){
      var show = zh.hidden; zh.hidden = !show;
      b.textContent = fxT(show ? FX.bridge.hideChinese : FX.bridge.showChinese);
      b.setAttribute("aria-expanded", show ? "true" : "false");
    });
    wrap.appendChild(note); wrap.appendChild(b); wrap.appendChild(zh);
    boxEl.appendChild(wrap);
  });
}
/* SOL exam gate for practice mode: Chinese hidden while an exam is in
   progress (vaSOL.v1 exists only during an unfinished exam). */
function fxApplyExamGate(){
  var on = fxBridgeMode() === "practice";
  ["soleexam", "solstyle"].forEach(function(id){
    var sec = $(id); if (!sec) return;
    var inProgress = false;
    try { inProgress = !!window.localStorage.getItem("vaSOL.v1"); } catch(e){}
    sec.classList.toggle("fx-exam-gate", !!(on && inProgress));
    var note = sec.querySelector(".fx-exam-note");
    if (on && inProgress && !note){
      note = document.createElement("p"); note.className = "fx-note fx-exam-note"; note.setAttribute("role", "note");
      sec.appendChild(note);
    }
    if (note) note.textContent = fxT(FX.bridge.afterExam);
    if (note) note.hidden = !(on && inProgress);
  });
}
document.addEventListener("click", function(){ setTimeout(fxApplyExamGate, 80); });

/* ---------------- F07 term deck (drawer / bottom sheet) ---------------- */
var fxDeckBack = document.createElement("div"); fxDeckBack.className = "fx-drawer-back";
var fxDeck = document.createElement("div"); fxDeck.className = "fx-drawer"; fxDeck.id = "fxTermDeck";
fxDeck.setAttribute("role", "dialog"); fxDeck.setAttribute("aria-modal", "false");
document.body.appendChild(fxDeckBack); document.body.appendChild(fxDeck);
var fxDeckReturnFocus = null, fxSpeakingBtn = null;
/* Same speaker glyph as the lesson vocab cards / flashcard deck. */
var FX_SPEAK_SVG = "<svg viewBox='0 0 24 24' width='20' height='20' fill='currentColor' aria-hidden='true' focusable='false'><path d='M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z'/></svg>";
function fxStopSpeak(){
  if (typeof speechSupported !== "undefined" && speechSupported()){ try { window.speechSynthesis.cancel(); } catch(e){} }
  if (fxSpeakingBtn){
    fxSpeakingBtn.classList.remove("fx-speaking");
    fxSpeakingBtn.setAttribute("aria-label", fxT(FX.terms.hear) + ": " + (fxSpeakingBtn.getAttribute("data-fx-term") || ""));
    fxSpeakingBtn = null;
  }
}
function fxCloseTermDeck(){
  fxStopSpeak();
  fxDeck.classList.remove("open"); fxDeckBack.classList.remove("open");
  if (fxDeckReturnFocus && fxDeckReturnFocus.focus) fxDeckReturnFocus.focus();
  fxDeckReturnFocus = null;
}
fxDeckBack.addEventListener("click", fxCloseTermDeck);
document.addEventListener("keydown", function(e){ if (e.key === "Escape" && fxDeck.classList.contains("open")) fxCloseTermDeck(); });
function fxOpenTermDeck(){
  var lid = (typeof currentLesson !== "undefined" && currentLesson >= 0) ? currentLesson :
    ((typeof lastLessonIdx !== "undefined" && lastLessonIdx >= 0) ? lastLessonIdx : -1);
  fxDeckReturnFocus = document.activeElement;
  var host = fxDeck; host.innerHTML = "";
  var head = document.createElement("div"); head.className = "fx-row"; head.style.justifyContent = "space-between";
  var h = document.createElement("h3"); h.id = "fxTermTitle"; h.style.margin = "0";
  var close = document.createElement("button"); close.type = "button"; close.className = "btn btn-line"; close.id = "fxTermClose";
  close.textContent = fxT(FX.terms.close);
  close.addEventListener("click", fxCloseTermDeck);
  head.appendChild(h); head.appendChild(close); host.appendChild(head);
  fxDeck.setAttribute("aria-labelledby", "fxTermTitle");
  if (lid < 0 || !LESSONS[lid]){
    h.textContent = fxT(FX.terms.open);
    var p0 = document.createElement("p"); p0.className = "fx-sub"; p0.textContent = fxT(FX.terms.noTerms); host.appendChild(p0);
  } else {
    var L = LESSONS[lid];
    h.textContent = fxFill(fxT(FX.terms.title), { lessonTitle: fxT(L.t) });
    var cnt = document.createElement("p"); cnt.className = "fx-note";
    cnt.textContent = fxFill(fxT(FX.terms.count), { count: (L.v || []).length });
    host.appendChild(cnt);
    if (!L.v || !L.v.length){
      var p1 = document.createElement("p"); p1.className = "fx-sub"; p1.textContent = fxT(FX.terms.noTerms); host.appendChild(p1);
    }
    (L.v || []).forEach(function(v, vi){
      var d = document.createElement("div"); d.className = "fx-term";
      var top = document.createElement("div"); top.className = "fx-row";
      var en = document.createElement("span"); en.className = "fx-term-en"; en.setAttribute("lang", "en"); en.textContent = v[0];
      var zhT = document.createElement("span"); zhT.setAttribute("lang", "zh-Hans"); zhT.textContent = v[1];
      top.appendChild(en); top.appendChild(zhT);
      var hear = document.createElement("button"); hear.type = "button"; hear.className = "fx-hearbtn"; hear.innerHTML = FX_SPEAK_SVG;
      hear.setAttribute("data-fx-term", v[0]);
      hear.setAttribute("aria-label", fxT(FX.terms.hear) + ": " + v[0]);
      hear.setAttribute("title", fxT(FX.terms.hear));
      hear.addEventListener("click", function(){
        if (fxSpeakingBtn === hear){ fxStopSpeak(); return; }
        fxStopSpeak();
        if (!(typeof speechSupported !== "undefined" && speechSupported() && typeof speakTerm === "function")){
          var msg = document.createElement("p"); msg.className = "fx-note"; msg.setAttribute("role", "status");
          msg.textContent = fxT(FX.terms.speechUnavailable); d.appendChild(msg); return;
        }
        fxSpeakingBtn = hear; hear.classList.add("fx-speaking");
        hear.setAttribute("aria-label", fxT(FX.terms.stop) + ": " + v[0]);
        try { speakTerm(v[0]); } catch(e){ fxStopSpeak(); }
        setTimeout(function(){ if (fxSpeakingBtn === hear) fxStopSpeak(); }, 6000);
      });
      top.appendChild(hear);
      d.appendChild(top);
      var def = document.createElement("p"); def.style.margin = ".35rem 0 0";
      def.innerHTML = fxH([v[2], v[3]]);
      d.appendChild(def);
      var rc = document.createElement("button"); rc.type = "button"; rc.className = "fx-cardlink";
      rc.textContent = fxT(FX.terms.reviewCard);
      rc.addEventListener("click", function(){
        var lid2 = lid, vid2 = vi;
        fxCloseTermDeck();
        /* Point the deck at THIS lesson in browse mode and land on THIS
           term's card — set the state directly (the same state the scope
           chips maintain) instead of clicking the scope chip, which
           rebuilt the deck at card 1 and, in due mode, could leave this
           card out entirely. */
        try {
          if (lid2 >= 0 && LESSONS[lid2]){
            if (typeof lastLessonIdx !== "undefined") lastLessonIdx = lid2;
            if (typeof flashMode !== "undefined") flashMode = "all";
            if (typeof flashScope !== "undefined"){
              flashScope = "lesson";
              document.querySelectorAll("[data-fscope]").forEach(function(x){ x.setAttribute("aria-pressed", x.getAttribute("data-fscope") === "lesson" ? "true" : "false"); });
            }
            if (typeof buildDeck === "function") buildDeck();
            if (typeof deck !== "undefined"){
              for (var k = 0; k < deck.length; k++){ if (deck[k].lid === lid2 && deck[k].vid === vid2){ deckIdx = k; break; } }
            }
            if (typeof showFlash === "function") showFlash(true);
          }
        } catch(e){}
        if (typeof closeLesson === "function" && $("modalBack") && $("modalBack").classList.contains("open")) closeLesson();
        /* closeLesson() calls history.back() (opening the lesson pushed
           a state); the scroll restoration for that pop lands after this
           handler runs and used to cancel the jump, dropping the learner
           back at the top of the page. Wait for the pop (or a short
           fallback) to settle before scrolling to the flashcards — the
           same pattern as the lesson's own flashcard button. */
        var jumped = false;
        var go = function(){
          if (jumped) return; jumped = true;
          /* Step 8: while the router is on, the flashcards live in
             their own view — route there first, then land on the
             card once the view is on screen. Router off (or already
             on the flashcards view): the original landing, unchanged. */
          if (window.VARouter && window.VARouter.started && window.VARouter.currentView !== "view-flashcards"){
            window.VARouter.navigate("/flashcards");
            setTimeout(landOnCard, 160);
          } else landOnCard();
        };
        var landOnCard = function(){
          var card = $("flashCard");
          if (!card){ fxScrollTo("flash"); return; }
          /* Land on the CARD itself, not just the section top: the flash
             section's header, scope and mode controls push the card
             below the fold, so scroll the card to just under the sticky
             toolbar, then re-check once the smooth scroll settles and
             correct instantly if anything (scroll restoration, a late
             layout shift) left it out of view. */
          var smooth = !(typeof reducedMotion !== "undefined" && reducedMotion);
          var aim = function(){
            var r = card.getBoundingClientRect();
            return Math.max(0, Math.round(r.top + window.scrollY - 150));
          };
          window.scrollTo({ top: aim(), behavior: smooth ? "smooth" : "auto" });
          try { card.focus({ preventScroll: true }); } catch(e){ try { card.focus(); } catch(e2){} }
          setTimeout(function(){
            var r = card.getBoundingClientRect();
            if (r.top < 140 || r.top > window.innerHeight - 160)
              window.scrollTo({ top: aim(), behavior: "auto" });
          }, smooth ? 650 : 60);
        };
        var onPop = function(){ window.removeEventListener("popstate", onPop); setTimeout(go, 40); };
        window.addEventListener("popstate", onPop);
        setTimeout(function(){ window.removeEventListener("popstate", onPop); go(); }, 300);
      });
      d.appendChild(rc);
      host.appendChild(d);
    });
  }
  fxDeckBack.classList.add("open"); fxDeck.classList.add("open");
  close.focus();
}

/* =====================================================================
   F02 — Worked Example → Completion Problem → Independent Try
   Enabled ONLY for concepts with complete bilingual authored content
   below (the plan forbids auto-applying it to all 73 lessons). Support
   fades only after success: a stage unlocks when a variant is finished
   with every check correct on its first try and nothing revealed.
   Progress: NEW per-concept keys vaF02.<conceptId>.v1. Raw responses
   are never stored — only stage completions, position, variants used.
   ===================================================================== */
function fxMC(q, o1, o2, o3, ans, why){ return { q: q, options: [o1, o2, o3], answer: ans, why: why }; }
var F02_CONCEPTS = [
{ conceptId: "unit-rate", lessonIdx: 0, version: 1,
  title: ["Unit rates, step by step", "单位比率，一步一步来"],
  worked: [
    { id: "w1", problem: ["6 pens cost $3.60. What is the price for ONE pen?", "6 支笔共 $3.60。一支笔多少钱？"],
      steps: [
        { text: ["Start with what you know: $3.60 is the total for 6 pens.", "先看已知条件：$3.60 是 6 支笔的总价。"],
          predict: fxMC(["What should happen next?", "下一步应该怎么做？"],
            ["Divide the total cost by the number of pens", "用总价除以笔的数量"],
            ["Multiply the total cost by the number of pens", "用总价乘以笔的数量"],
            ["Add the cost and the number of pens", "把总价和笔的数量相加"], 0,
            ["A unit price shares the total equally among the pens, so you divide.", "单价是把总价平均分给每支笔，所以要用除法。"]) },
        { text: ["Divide: $3.60 ÷ 6 = $0.60.", "做除法：$3.60 ÷ 6 = $0.60。"],
          predict: fxMC(["What is $3.60 ÷ 6?", "$3.60 ÷ 6 等于多少？"],
            ["$0.60", "$0.60"], ["$6.00", "$6.00"], ["$0.06", "$0.06"], 0,
            ["6 × $0.60 = $3.60, so $3.60 ÷ 6 = $0.60.", "6 × $0.60 = $3.60，所以 $3.60 ÷ 6 = $0.60。"]) },
        { text: ["Check by multiplying back: 6 × $0.60 = $3.60 ✓ One pen costs $0.60.", "乘回去检验：6 × $0.60 = $3.60 ✓ 一支笔 $0.60。"],
          predict: fxMC(["How can you check the answer?", "怎样检验答案？"],
            ["Multiply the unit price by the number of pens and compare with the total", "把单价乘以笔的数量，和总价比较"],
            ["Subtract the unit price from the total", "用总价减去单价"],
            ["Divide the number of pens by the unit price", "用笔的数量除以单价"], 0,
            ["Multiplying back undoes the division — if you land on the total, the unit price is right.", "乘回去是除法的逆运算——结果等于总价，单价就对了。"]) }
      ] },
    { id: "w2", problem: ["4 notebooks cost $10.00. What is the price for ONE notebook?", "4 本笔记本共 $10.00。一本多少钱？"],
      steps: [
        { text: ["Start with what you know: $10.00 is the total for 4 notebooks.", "先看已知条件：$10.00 是 4 本笔记本的总价。"],
          predict: fxMC(["What should happen next?", "下一步应该怎么做？"],
            ["Divide the total cost by the number of notebooks", "用总价除以笔记本的数量"],
            ["Multiply the total cost by the number of notebooks", "用总价乘以笔记本的数量"],
            ["Subtract the number of notebooks from the cost", "用总价减去笔记本的数量"], 0,
            ["A unit price shares the total equally, so you divide.", "单价是把总价平均分，所以要用除法。"]) },
        { text: ["Divide: $10.00 ÷ 4 = $2.50.", "做除法：$10.00 ÷ 4 = $2.50。"],
          predict: fxMC(["What is $10.00 ÷ 4?", "$10.00 ÷ 4 等于多少？"],
            ["$2.50", "$2.50"], ["$0.40", "$0.40"], ["$25.00", "$25.00"], 0,
            ["4 × $2.50 = $10.00, so $10.00 ÷ 4 = $2.50.", "4 × $2.50 = $10.00，所以 $10.00 ÷ 4 = $2.50。"]) },
        { text: ["Check by multiplying back: 4 × $2.50 = $10.00 ✓ One notebook costs $2.50.", "乘回去检验：4 × $2.50 = $10.00 ✓ 一本笔记本 $2.50。"],
          predict: fxMC(["How can you check the answer?", "怎样检验答案？"],
            ["Multiply the unit price by the number of notebooks and compare with the total", "把单价乘以笔记本的数量，和总价比较"],
            ["Add the unit price to the total", "把单价加到总价上"],
            ["Divide the total by the total", "用总价除以总价"], 0,
            ["Multiplying back undoes the division.", "乘回去是除法的逆运算。"]) }
      ] }
  ],
  completion: [
    { id: "c1", problem: ["5 juice boxes cost $4.00. Find the price for ONE juice box.", "5 盒果汁共 $4.00。求一盒的价格。"],
      shown: [["Unit price = total cost ÷ number of boxes.", "单价 = 总价 ÷ 盒数。"]],
      predict: fxMC(["Which division gives the unit price?", "哪个除法能算出单价？"],
        ["$4.00 ÷ 5", "$4.00 ÷ 5"], ["5 ÷ $4.00", "5 ÷ $4.00"], ["$4.00 × 5", "$4.00 × 5"], 0,
        ["Total ÷ count — the total always goes first.", "总价 ÷ 数量——总价永远在前面。"]),
      missing: { accept: { n: 0.8, tol: 0.011 }, why: ["$4.00 ÷ 5 = $0.80, so one juice box costs $0.80. Check: 5 × $0.80 = $4.00 ✓", "$4.00 ÷ 5 = $0.80，一盒果汁 $0.80。检验：5 × $0.80 = $4.00 ✓"] } },
    { id: "c2", problem: ["8 granola bars cost $6.00. Find the price for ONE bar.", "8 根燕麦棒共 $6.00。求一根的价格。"],
      shown: [["Unit price = total cost ÷ number of bars.", "单价 = 总价 ÷ 根数。"]],
      predict: fxMC(["Which division gives the unit price?", "哪个除法能算出单价？"],
        ["$6.00 ÷ 8", "$6.00 ÷ 8"], ["8 ÷ $6.00", "8 ÷ $6.00"], ["$6.00 × 8", "$6.00 × 8"], 0,
        ["Total ÷ count — the total always goes first.", "总价 ÷ 数量——总价永远在前面。"]),
      missing: { accept: { n: 0.75, tol: 0.011 }, why: ["$6.00 ÷ 8 = $0.75, so one bar costs $0.75. Check: 8 × $0.75 = $6.00 ✓", "$6.00 ÷ 8 = $0.75，一根 $0.75。检验：8 × $0.75 = $6.00 ✓"] } }
  ],
  independent: [
    { id: "i1", problem: ["3 muffins cost $5.25. What is the price for ONE muffin? (Answer like 1.75)", "3 个松饼共 $5.25。一个松饼多少钱？（像 1.75 这样作答）"],
      accept: { n: 1.75, tol: 0.011 }, why: ["$5.25 ÷ 3 = $1.75 per muffin. Check: 3 × $1.75 = $5.25 ✓", "$5.25 ÷ 3 = 每个 $1.75。检验：3 × $1.75 = $5.25 ✓"] },
    { id: "i2", problem: ["10 pencils cost $4.50. What is the price for ONE pencil? (Answer like 0.45)", "10 支铅笔共 $4.50。一支多少钱？（像 0.45 这样作答）"],
      accept: { n: 0.45, tol: 0.011 }, why: ["$4.50 ÷ 10 = $0.45 per pencil. Check: 10 × $0.45 = $4.50 ✓", "$4.50 ÷ 10 = 每支 $0.45。检验：10 × $0.45 = $4.50 ✓"] }
  ] },
{ conceptId: "absolute-value", lessonIdx: 1, version: 1,
  title: ["Absolute value as distance", "绝对值就是距离"],
  worked: [
    { id: "w1", problem: ["What is |−9|?", "|−9| 等于多少？"],
      steps: [
        { text: ["Absolute value means distance from 0 on the number line.", "绝对值表示数轴上到 0 的距离。"],
          predict: fxMC(["What does |−9| measure?", "|−9| 表示什么？"],
            ["The distance from −9 to 0", "从 −9 到 0 的距离"],
            ["How far below zero a temperature is", "温度低于零多少"],
            ["The opposite of 9", "9 的相反数"], 0,
            ["Absolute value is always a distance from 0.", "绝对值永远是到 0 的距离。"]) },
        { text: ["Count the distance: from −9 to 0 is 9 units.", "数一数距离：从 −9 到 0 是 9 个单位。"],
          predict: fxMC(["Can a distance be negative?", "距离可以是负数吗？"],
            ["No — distance is never negative", "不能——距离永远不会是负数"],
            ["Yes, when the number is negative", "可以，当这个数是负数时"],
            ["Only for temperatures", "只有温度可以"], 0,
            ["Distance tells how far, not which direction, so it is never negative.", "距离只表示有多远，不表示方向，所以永远不会是负数。"]) },
        { text: ["So |−9| = 9.", "所以 |−9| = 9。"],
          predict: fxMC(["What is |−9|?", "|−9| 等于多少？"],
            ["9", "9"], ["−9", "−9"], ["0", "0"], 0,
            ["|−9| is the distance from −9 to 0, which is 9.", "|−9| 是 −9 到 0 的距离，也就是 9。"]) }
      ] },
    { id: "w2", problem: ["What is |7|?", "|7| 等于多少？"],
      steps: [
        { text: ["Absolute value means distance from 0 on the number line.", "绝对值表示数轴上到 0 的距离。"],
          predict: fxMC(["What does |7| measure?", "|7| 表示什么？"],
            ["The distance from 7 to 0", "从 7 到 0 的距离"],
            ["The opposite of 7", "7 的相反数"],
            ["7 minus 0, with a sign flip", "7 减 0 再变号"], 0,
            ["Absolute value is always a distance from 0.", "绝对值永远是到 0 的距离。"]) },
        { text: ["Count the distance: from 7 to 0 is 7 units.", "数一数距离：从 7 到 0 是 7 个单位。"],
          predict: fxMC(["For a positive number, what is its absolute value?", "正数的绝对值是什么？"],
            ["The number itself", "它本身"],
            ["Its opposite", "它的相反数"],
            ["Zero", "零"], 0,
            ["A positive number's distance from 0 is the number itself.", "正数到 0 的距离就是它本身。"]) },
        { text: ["So |7| = 7.", "所以 |7| = 7。"],
          predict: fxMC(["What is |7|?", "|7| 等于多少？"],
            ["7", "7"], ["−7", "−7"], ["0", "0"], 0,
            ["7 is 7 units from 0, so |7| = 7.", "7 离 0 有 7 个单位，所以 |7| = 7。"]) }
      ] }
  ],
  completion: [
    { id: "c1", problem: ["Find |−4|.", "求 |−4|。"],
      shown: [["|−4| means the distance from −4 to 0.", "|−4| 表示从 −4 到 0 的距离。"]],
      predict: fxMC(["How many units is −4 from 0?", "−4 离 0 有几个单位？"],
        ["4", "4"], ["−4", "−4"], ["0", "0"], 0,
        ["Count from −4 up to 0: 4 units.", "从 −4 数到 0：4 个单位。"]),
      missing: { accept: { n: 4, tol: 0 }, why: ["The distance is 4, and distance is never negative, so |−4| = 4.", "距离是 4，而距离永远不会是负数，所以 |−4| = 4。"] } },
    { id: "c2", problem: ["Find |−12|.", "求 |−12|。"],
      shown: [["|−12| means the distance from −12 to 0.", "|−12| 表示从 −12 到 0 的距离。"]],
      predict: fxMC(["How many units is −12 from 0?", "−12 离 0 有几个单位？"],
        ["12", "12"], ["−12", "−12"], ["0", "0"], 0,
        ["Count from −12 up to 0: 12 units.", "从 −12 数到 0：12 个单位。"]),
      missing: { accept: { n: 12, tol: 0 }, why: ["The distance is 12, so |−12| = 12.", "距离是 12，所以 |−12| = 12。"] } }
  ],
  independent: [
    { id: "i1", problem: ["What is |−15|?", "|−15| 等于多少？"],
      accept: { n: 15, tol: 0 }, why: ["−15 is 15 units from 0, so |−15| = 15.", "−15 离 0 有 15 个单位，所以 |−15| = 15。"] },
    { id: "i2", problem: ["A diver is at −20 feet. How far is the diver from the surface (0 feet)?", "一名潜水员在 −20 英尺处。他离水面（0 英尺）有多远？"],
      accept: { n: 20, tol: 0 }, why: ["Distance from 0 is the absolute value: |−20| = 20 feet.", "到 0 的距离就是绝对值：|−20| = 20 英尺。"] }
  ] },
{ conceptId: "one-step-equations", lessonIdx: 4, version: 1,
  title: ["Solving one-step equations", "解一步方程"],
  worked: [
    { id: "w1", problem: ["Solve x + 6 = 14.", "解方程 x + 6 = 14。"],
      steps: [
        { text: ["x has 6 added to it. The inverse (undoing) operation for +6 is −6.", "x 被加上了 6。+6 的逆运算是 −6。"],
          predict: fxMC(["What undoes +6?", "什么能抵消 +6？"],
            ["Subtract 6 from both sides", "两边同时减 6"],
            ["Add 6 to both sides", "两边同时加 6"],
            ["Divide both sides by 6", "两边同时除以 6"], 0,
            ["Inverse operations undo each other: −6 undoes +6.", "逆运算互相抵消：−6 抵消 +6。"]) },
        { text: ["Subtract 6 from BOTH sides: x + 6 − 6 = 14 − 6.", "两边同时减 6：x + 6 − 6 = 14 − 6。"],
          predict: fxMC(["Why subtract from BOTH sides?", "为什么两边都要减？"],
            ["To keep the equation balanced", "为了保持方程两边平衡"],
            ["To make the left side smaller", "为了让左边变小"],
            ["Because 6 is on the left", "因为 6 在左边"], 0,
            ["An equation is a balance — whatever you do to one side, do to the other.", "方程就像天平——对一边做的事，也要对另一边做。"]) },
        { text: ["x = 8. Check: 8 + 6 = 14 ✓", "x = 8。检验：8 + 6 = 14 ✓"],
          predict: fxMC(["How do you check x = 8?", "怎样检验 x = 8？"],
            ["Put 8 in place of x: 8 + 6 = 14 ✓", "把 8 代入 x：8 + 6 = 14 ✓"],
            ["Add 8 and 14 together", "把 8 和 14 相加"],
            ["Solve a different equation", "再解另一个方程"], 0,
            ["Substitute the answer back into the original equation.", "把答案代回原方程检验。"]) }
      ] },
    { id: "w2", problem: ["Solve x − 5 = 9.", "解方程 x − 5 = 9。"],
      steps: [
        { text: ["x has 5 subtracted from it. The inverse of −5 is +5.", "x 被减去了 5。−5 的逆运算是 +5。"],
          predict: fxMC(["What undoes −5?", "什么能抵消 −5？"],
            ["Add 5 to both sides", "两边同时加 5"],
            ["Subtract 5 from both sides", "两边同时减 5"],
            ["Multiply both sides by 5", "两边同时乘 5"], 0,
            ["Inverse operations undo each other: +5 undoes −5.", "逆运算互相抵消：+5 抵消 −5。"]) },
        { text: ["Add 5 to BOTH sides: x − 5 + 5 = 9 + 5.", "两边同时加 5：x − 5 + 5 = 9 + 5。"],
          predict: fxMC(["Why add to BOTH sides?", "为什么两边都要加？"],
            ["To keep the equation balanced", "为了保持方程两边平衡"],
            ["To make the right side bigger", "为了让右边变大"],
            ["Because 5 is on the left", "因为 5 在左边"], 0,
            ["An equation is a balance — whatever you do to one side, do to the other.", "方程就像天平——对一边做的事，也要对另一边做。"]) },
        { text: ["x = 14. Check: 14 − 5 = 9 ✓", "x = 14。检验：14 − 5 = 9 ✓"],
          predict: fxMC(["How do you check x = 14?", "怎样检验 x = 14？"],
            ["Put 14 in place of x: 14 − 5 = 9 ✓", "把 14 代入 x：14 − 5 = 9 ✓"],
            ["Add 14 and 9 together", "把 14 和 9 相加"],
            ["Change the 9 to a 5", "把 9 改成 5"], 0,
            ["Substitute the answer back into the original equation.", "把答案代回原方程检验。"]) }
      ] }
  ],
  completion: [
    { id: "c1", problem: ["Solve x + 9 = 17.", "解方程 x + 9 = 17。"],
      shown: [["Undo +9 by subtracting 9 from both sides.", "用两边同时减 9 来抵消 +9。"], ["x + 9 − 9 = 17 − 9", "x + 9 − 9 = 17 − 9"]],
      predict: fxMC(["What should you do first?", "第一步应该做什么？"],
        ["Subtract 9 from both sides", "两边同时减 9"],
        ["Add 9 to both sides", "两边同时加 9"],
        ["Move the 9 to the right side", "把 9 移到右边"], 0,
        ["Undo +9 with its inverse, −9, on both sides.", "用逆运算 −9 在两边同时抵消 +9。"]),
      missing: { accept: { n: 8, tol: 0 }, why: ["17 − 9 = 8, so x = 8. Check: 8 + 9 = 17 ✓", "17 − 9 = 8，所以 x = 8。检验：8 + 9 = 17 ✓"] } },
    { id: "c2", problem: ["Solve x − 4 = 11.", "解方程 x − 4 = 11。"],
      shown: [["Undo −4 by adding 4 to both sides.", "用两边同时加 4 来抵消 −4。"], ["x − 4 + 4 = 11 + 4", "x − 4 + 4 = 11 + 4"]],
      predict: fxMC(["What should you do first?", "第一步应该做什么？"],
        ["Add 4 to both sides", "两边同时加 4"],
        ["Subtract 4 from both sides", "两边同时减 4"],
        ["Move the 4 to the right side", "把 4 移到右边"], 0,
        ["Undo −4 with its inverse, +4, on both sides.", "用逆运算 +4 在两边同时抵消 −4。"]),
      missing: { accept: { n: 15, tol: 0 }, why: ["11 + 4 = 15, so x = 15. Check: 15 − 4 = 11 ✓", "11 + 4 = 15，所以 x = 15。检验：15 − 4 = 11 ✓"] } }
  ],
  independent: [
    { id: "i1", problem: ["Solve x + 13 = 20. (Answer like 7, or x = 7)", "解方程 x + 13 = 20。（像 7 或 x = 7 这样作答）"],
      accept: { n: 7, tol: 0 }, why: ["Subtract 13 from both sides: 20 − 13 = 7, so x = 7. Check: 7 + 13 = 20 ✓", "两边同时减 13：20 − 13 = 7，所以 x = 7。检验：7 + 13 = 20 ✓"] },
    { id: "i2", problem: ["Solve 3x = 21. (Answer like 7, or x = 7)", "解方程 3x = 21。（像 7 或 x = 7 这样作答）"],
      accept: { n: 7, tol: 0 }, why: ["Undo ×3 by dividing both sides by 3: 21 ÷ 3 = 7, so x = 7. Check: 3 × 7 = 21 ✓", "用两边同时除以 3 来抵消 ×3：21 ÷ 3 = 7，所以 x = 7。检验：3 × 7 = 21 ✓"] }
  ] },
{ conceptId: "order-of-operations", lessonIdx: 3, version: 1,
  title: ["Order of operations", "运算顺序"],
  worked: [
    { id: "w1", problem: ["Simplify 5 + 2 × 3.", "计算 5 + 2 × 3。"],
      steps: [
        { text: ["Multiplication and division come before addition and subtraction.", "乘法和除法要先于加法和减法。"],
          predict: fxMC(["Which operation do you do FIRST in 5 + 2 × 3?", "在 5 + 2 × 3 中，先算哪一步？"],
            ["2 × 3 (multiplication)", "2 × 3（乘法）"],
            ["5 + 2 (addition on the left)", "5 + 2（左边的加法）"],
            ["It does not matter", "无所谓"], 0,
            ["Multiply before you add, even when the addition is written first.", "即使加法写在前面，也要先乘后加。"]) },
        { text: ["Multiply first: 2 × 3 = 6. The expression is now 5 + 6.", "先乘：2 × 3 = 6。现在算式变成 5 + 6。"],
          predict: fxMC(["After multiplying, what is left to compute?", "乘完之后，还剩什么要算？"],
            ["5 + 6", "5 + 6"], ["5 × 6", "5 × 6"], ["2 + 3", "2 + 3"], 0,
            ["The × is finished; only the + remains.", "乘法已经算完，只剩下加法。"]) },
        { text: ["Add: 5 + 6 = 11.", "做加法：5 + 6 = 11。"],
          predict: fxMC(["What is the final value of 5 + 2 × 3?", "5 + 2 × 3 的最终结果是？"],
            ["11", "11"], ["21", "21"], ["13", "13"], 0,
            ["5 + 6 = 11. (21 is the trap answer from adding first.)", "5 + 6 = 11。（21 是先加后乘的陷阱答案。）"]) }
      ] },
    { id: "w2", problem: ["Simplify 12 − 8 ÷ 2.", "计算 12 − 8 ÷ 2。"],
      steps: [
        { text: ["Multiplication and division come before addition and subtraction.", "乘法和除法要先于加法和减法。"],
          predict: fxMC(["Which operation do you do FIRST in 12 − 8 ÷ 2?", "在 12 − 8 ÷ 2 中，先算哪一步？"],
            ["8 ÷ 2 (division)", "8 ÷ 2（除法）"],
            ["12 − 8 (subtraction on the left)", "12 − 8（左边的减法）"],
            ["It does not matter", "无所谓"], 0,
            ["Divide before you subtract.", "先除后减。"]) },
        { text: ["Divide first: 8 ÷ 2 = 4. The expression is now 12 − 4.", "先除：8 ÷ 2 = 4。现在算式变成 12 − 4。"],
          predict: fxMC(["After dividing, what is left to compute?", "除完之后，还剩什么要算？"],
            ["12 − 4", "12 − 4"], ["12 ÷ 4", "12 ÷ 4"], ["8 − 2", "8 − 2"], 0,
            ["The ÷ is finished; only the − remains.", "除法已经算完，只剩下减法。"]) },
        { text: ["Subtract: 12 − 4 = 8.", "做减法：12 − 4 = 8。"],
          predict: fxMC(["What is the final value of 12 − 8 ÷ 2?", "12 − 8 ÷ 2 的最终结果是？"],
            ["8", "8"], ["2", "2"], ["10", "10"], 0,
            ["12 − 4 = 8. (2 is the trap answer from subtracting first.)", "12 − 4 = 8。（2 是先减后除的陷阱答案。）"]) }
      ] }
  ],
  completion: [
    { id: "c1", problem: ["Simplify 4 + 3 × 2.", "计算 4 + 3 × 2。"],
      shown: [["Multiply before you add: 3 × 2 = 6.", "先乘后加：3 × 2 = 6。"], ["4 + 6 = ?", "4 + 6 = ?"]],
      predict: fxMC(["Which part is done first?", "先算哪一部分？"],
        ["3 × 2", "3 × 2"], ["4 + 3", "4 + 3"], ["4 × 2", "4 × 2"], 0,
        ["Multiplication comes before addition.", "乘法先于加法。"]),
      missing: { accept: { n: 10, tol: 0 }, why: ["4 + 6 = 10, so 4 + 3 × 2 = 10.", "4 + 6 = 10，所以 4 + 3 × 2 = 10。"] } },
    { id: "c2", problem: ["Simplify 20 − 6 ÷ 3.", "计算 20 − 6 ÷ 3。"],
      shown: [["Divide before you subtract: 6 ÷ 3 = 2.", "先除后减：6 ÷ 3 = 2。"], ["20 − 2 = ?", "20 − 2 = ?"]],
      predict: fxMC(["Which part is done first?", "先算哪一部分？"],
        ["6 ÷ 3", "6 ÷ 3"], ["20 − 6", "20 − 6"], ["20 ÷ 3", "20 ÷ 3"], 0,
        ["Division comes before subtraction.", "除法先于减法。"]),
      missing: { accept: { n: 18, tol: 0 }, why: ["20 − 2 = 18, so 20 − 6 ÷ 3 = 18.", "20 − 2 = 18，所以 20 − 6 ÷ 3 = 18。"] } }
  ],
  independent: [
    { id: "i1", problem: ["Simplify 7 + 4 × 2.", "计算 7 + 4 × 2。"],
      accept: { n: 15, tol: 0 }, why: ["Multiply first: 4 × 2 = 8, then 7 + 8 = 15.", "先乘：4 × 2 = 8，再算 7 + 8 = 15。"] },
    { id: "i2", problem: ["Simplify 18 − 3 × 4.", "计算 18 − 3 × 4。"],
      accept: { n: 6, tol: 0 }, why: ["Multiply first: 3 × 4 = 12, then 18 − 12 = 6.", "先乘：3 × 4 = 12，再算 18 − 12 = 6。"] }
  ] }
];
var F02_BY_LESSON = {};
F02_CONCEPTS.forEach(function(c){ F02_BY_LESSON[c.lessonIdx] = c; });
function fx02Key(c){ return "vaF02." + c.conceptId + ".v1"; }
function fx02Load(c){
  var rec = fxGet(fx02Key(c), null);
  if (!rec || rec.schemaVersion !== 1 || !Array.isArray(rec.completedStages) || !rec.used || typeof rec.used !== "object")
    return { schemaVersion: 1, contentVersion: c.version, completedStages: [], currentStage: "worked", used: { worked: [], completion: [], independent: [] }, updatedAt: null, _reset: false };
  if (rec.contentVersion !== c.version){
    /* content changed: restart this concept's stages; lesson progress untouched */
    return { schemaVersion: 1, contentVersion: c.version, completedStages: [], currentStage: "worked", used: { worked: [], completion: [], independent: [] }, updatedAt: null, _reset: true };
  }
  ["worked", "completion", "independent"].forEach(function(s){ if (!Array.isArray(rec.used[s])) rec.used[s] = []; });
  if (["worked", "completion", "independent"].indexOf(rec.currentStage) < 0) rec.currentStage = "worked";
  return rec;
}
function fx02Save(c, rec){
  rec.updatedAt = new Date().toISOString();
  var ok = fxSet(fx02Key(c), rec);
  if (!ok) fx02SaveFailed = true;
  return ok;
}
var fx02SaveFailed = false;
function fx02ParseNum(raw){
  if (raw == null) return null;
  var s = String(raw).trim().toLowerCase().replace(/^x\s*=\s*/, "").replace(/[$,%\s]/g, "");
  if (!s) return null;
  var m = s.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
  if (m){ var den = parseFloat(m[2]); if (den === 0) return null; return parseFloat(m[1]) / den; }
  var v = parseFloat(s);
  return isFinite(v) ? v : null;
}
function fx02Check(accept, raw){
  var v = fx02ParseNum(raw);
  if (v === null) return false;
  return Math.abs(v - accept.n) <= (accept.tol || 0);
}
/* runtime (never persisted): the live attempt on the current variant */
var fx02Rt = null;
function fx02PickVariant(c, rec, stage){
  var list = stage === "worked" ? c.worked : (stage === "completion" ? c.completion : c.independent);
  var used = rec.used[stage] || [];
  for (var i = 0; i < list.length; i++) if (used.indexOf(list[i].id) < 0) return list[i];
  var last = used[used.length - 1];
  for (var j = 0; j < list.length; j++) if (list[j].id !== last) return list[j];
  return list[0];
}
function fx02StartVariant(c, rec, stage){
  var v = fx02PickVariant(c, rec, stage);
  if ((rec.used[stage] || []).indexOf(v.id) < 0){ rec.used[stage].push(v.id); fx02Save(c, rec); }
  fx02Rt = { concept: c, stage: stage, variant: v, stepIdx: 0, revealed: 0, clean: true, phase: "predict", predOk: false, fb: null, done: false };
}
function fx02StageName(stage){ return stage === "worked" ? FX.f02.stageWorked : (stage === "completion" ? FX.f02.stageCompletion : FX.f02.stageIndependent); }
function fx02StageStatus(c, rec, stage){
  if (rec.completedStages.indexOf(stage) >= 0) return "done";
  if (rec.currentStage === stage) return "cur";
  return "lock";
}
var fx02Card = null;
/* The F02 card is ONE node with ONE runtime (fx02Rt) and the shared
   vaF02.<conceptId>.v1 stores. It has two hosts: the lesson modal's
   Learn panel (fx02Render, on every lesson fill) and the standalone
   Guided Practice view's #fxF02StandaloneHost (fx02RenderStandalone).
   fx02EnsureCard(where) MOVES that same node into the requested host
   with appendChild/insertBefore — never a copy, never a second card,
   so there is exactly one #fxF02Card, one set of body listeners (the
   body is rebuilt by innerHTML on every render) and one state. */
function fx02EnsureCard(where){
  var card = (fx02Card && fx02Card.isConnected) ? fx02Card : null;
  if (!card){
    card = document.createElement("div");
    card.className = "fx-card"; card.id = "fxF02Card"; card.style.marginTop = "1rem";
    fx02Card = card;
  }
  if (where === "view"){
    var host = $("fxF02StandaloneHost");
    if (host && card.parentNode !== host) host.appendChild(card);
    return card;
  }
  var learnPanel = $("jPanel-learn");
  if (learnPanel){
    if (card.parentNode !== learnPanel){
      var row = learnPanel.querySelector(".j-primary-row");
      if (row) learnPanel.insertBefore(card, row); else learnPanel.appendChild(card);
    }
  } else if (card.parentNode !== $("modalBox")){
    var ex = $("mExample");
    var sec = ex ? (ex.closest ? (ex.closest(".m-sec") || ex.parentElement) : ex.parentElement) : null;
    if (sec && sec.parentNode) sec.parentNode.insertBefore(card, sec.nextSibling);
    else if ($("modalBox")) $("modalBox").appendChild(card);
  }
  return card;
}
function fx02InGuidedView(el){
  return !!(el && el.closest && el.closest("#view-guided-practice"));
}
function fx02Render(lid){
  var c = F02_BY_LESSON[lid];
  var existing = $("fxF02Card");
  if (!c){
    /* A lesson without F02 content must not tear down the standalone
       Guided Practice card: only remove the card when it is parked in
       the modal (its pre-standalone behaviour). */
    if (existing && !fx02InGuidedView(existing)){ existing.remove(); fx02Card = null; fx02Rt = null; }
    return;
  }
  fx02RenderCard(c, "lesson");
}
function fx02RenderCard(c, where){
  var card = fx02EnsureCard(where);
  var rec = fx02Load(c);
  if (!fx02Rt || fx02Rt.concept !== c) fx02StartVariant(c, rec, rec.currentStage);
  var rt = fx02Rt;
  var stages = ["worked", "completion", "independent"];
  var h = "";
  h += "<h3>" + fxEsc(fxT(FX.f02.title)) + " · " + fxEsc(fxT(c.title)) + "</h3>";
  h += "<p class='fx-sub'>" + fxEsc(fxT(FX.f02.description)) + "</p>";
  if (rec._reset) h += "<p class='fx-fb no'>" + fxEsc(fxT(FX.f02.contentUpdated)) + "</p>";
  if (fx02SaveFailed) h += "<p class='fx-fb no' role='alert'>" + fxEsc(fxT(FX.f02.saveFailed)) + "</p>";
  h += "<div class='fx-steps' role='list' aria-label='" + fxEsc(fxFill(fxT(FX.f02.progress), { current: stages.indexOf(rt.stage) + 1 })) + "'>";
  stages.forEach(function(s, ix){
    var st = fx02StageStatus(c, rec, s);
    var label = fxT(fx02StageName(s)) + (st === "done" ? " ✓" : (st === "cur" ? " · " + fxT(FX.f02.currentStage) : ""));
    h += "<span class='fx-step " + st + "' role='listitem'>" + (ix + 1) + ". " + fxEsc(label) + "</span>";
  });
  h += "</div>";
  h += "<p class='fx-note'>" + fxEsc(fxT(FX.f02.supportRule)) + "</p>";
  h += "<div id='fx02Body'></div>";
  card.innerHTML = h;
  fx02RenderBody(c, rec, rt);
}
/* ---------------- F02 standalone (Guided Practice view) ----------------
   The dedicated /guided-practice view hosts the SAME F02 tool: a
   concept picker over all four authored concepts (they are tied to
   lessons 0/1/4/3, so the view lets the learner choose which one to
   practice), then the shared card below it. Progress reads and writes
   the same vaF02.<conceptId>.v1 records the lesson modal uses. */
var fx02ViewConceptId = null;
function fx02ViewConcept(){
  var i, c, r;
  if (fx02ViewConceptId){
    for (i = 0; i < F02_CONCEPTS.length; i++) if (F02_CONCEPTS[i].conceptId === fx02ViewConceptId) return F02_CONCEPTS[i];
  }
  var firstOpen = null;
  for (i = 0; i < F02_CONCEPTS.length; i++){
    c = F02_CONCEPTS[i]; r = fx02Load(c);
    if (r.completedStages.length > 0 && r.completedStages.length < 3) return c;
    if (r.completedStages.length < 3 && !firstOpen) firstOpen = c;
  }
  return firstOpen || F02_CONCEPTS[0];
}
function fx02ConceptStatusText(c){
  var r = fx02Load(c);
  if (r.completedStages.length >= 3) return fxT(FX.f02.completed);
  if (r.completedStages.length > 0) return fxT(fx02StageName(r.currentStage));
  return fxT(FX.f02.notStarted);
}
function fx02RenderStandalone(){
  var host = $("fxF02StandaloneHost"); if (!host) return;
  var mb = $("modalBack");
  if (mb && mb.classList.contains("open")) return; /* never steal the card out of an open lesson */
  var c = fx02ViewConcept();
  fx02ViewConceptId = c.conceptId;
  var bar = $("fxF02ConceptBar");
  if (bar){
    var h = "<p class='fx-note' style='font-weight:700;margin:0 0 .45rem'>" + fxEsc(fxT(FX.f02.choose)) + "</p><div class='fx-row' role='group' aria-label='" + fxEsc(fxT(FX.f02.choose)) + "'>";
    F02_CONCEPTS.forEach(function(cc){
      h += "<button type='button' class='fx-chipbtn' data-fx02concept='" + cc.conceptId + "' aria-pressed='" + (cc === c ? "true" : "false") + "'>" + fxEsc(fxT(cc.title)) + " · " + fxEsc(fx02ConceptStatusText(cc)) + "</button>";
    });
    h += "</div>";
    bar.innerHTML = h;
    bar.querySelectorAll("[data-fx02concept]").forEach(function(b){
      b.addEventListener("click", function(){
        fx02ViewConceptId = b.getAttribute("data-fx02concept");
        fx02RenderStandalone();
        var card = $("fxF02Card");
        if (card && card.scrollIntoView) card.scrollIntoView({ block: "start" });
      });
    });
  }
  /* Preserve a half-typed answer across a re-render (e.g. language switch). */
  var prevVal = null, prevFocus = false;
  var inp0 = $("fx02Input");
  if (inp0 && fx02InGuidedView(inp0)){ prevVal = inp0.value; prevFocus = (document.activeElement === inp0); }
  fx02RenderCard(c, "view");
  if (prevVal !== null){
    var inp1 = $("fx02Input");
    if (inp1){ inp1.value = prevVal; if (prevFocus){ try { inp1.focus({ preventScroll: true }); } catch(e){} } }
  }
}
/* The router calls this when the guided-practice view activates (the
   same refresh-on-activation pattern as the mastery map), so the card
   travels from the lesson modal into the view whenever the learner
   navigates here after practising inside a lesson. */
window.__fx02SyncStandalone = fx02RenderStandalone;
/* Guarded sync for the global re-render cycle: never move the card
   while a lesson is open, and never pull it out of a closed lesson
   modal (it may be mid-attempt there) — the router's activation hook
   above is what brings it into the view. When the card already lives
   in the view (or does not exist yet) a plain re-render is safe and
   keeps the picker statuses and language current. */
function fx02SyncStandaloneSafe(){
  var mb = $("modalBack");
  if (mb && mb.classList.contains("open")) return;
  var card = $("fxF02Card");
  if (card && !fx02InGuidedView(card)) return;
  fx02RenderStandalone();
}
function fx02FbHtml(rt){
  if (!rt.fb) return "";
  return "<div class='fx-fb " + (rt.fb.ok ? "ok" : "no") + "' role='status'>" + fxEsc(rt.fb.text) + (rt.fb.why ? "<br><b>" + fxEsc(fxT(FX.f02.explanation)) + ":</b> " + fxEsc(fxT(rt.fb.why)) : "") + "</div>";
}
function fx02McHtml(rt, mc){
  var h = "<p style='font-weight:700;margin:.6rem 0 .2rem'>" + fxEsc(fxT(FX.f02.predict)) + "</p>";
  h += "<p style='margin:.1rem 0'>" + fxEsc(fxT(mc.q)) + "</p>";
  mc.options.forEach(function(o, i){
    h += "<button type='button' class='fx-opt' data-fx02opt='" + i + "'>" + fxEsc(fxT(o)) + "</button>";
  });
  return h;
}
function fx02RenderBody(c, rec, rt){
  var body = $("fx02Body"); if (!body) return;
  var v = rt.variant, h = "";
  if (rt.stage === "worked"){
    h += "<p style='font-weight:700'>" + fxEsc(fxT(v.problem)) + "</p>";
    for (var i = 0; i < rt.revealed; i++) h += "<div class='fx-worked-step'>" + fxEsc(fxT(v.steps[i].text)) + "</div>";
    if (rt.done){
      h += fx02FbHtml(rt);
      if (rec.completedStages.indexOf("worked") >= 0)
        h += "<div class='fx-row'><button type='button' class='btn btn-gold' data-fx02act='next-stage'>" + fxEsc(fxT(FX.f02.nextStage)) + "</button><button type='button' class='btn btn-line' data-fx02act='again'>" + fxEsc(fxT(FX.f02.studyAgain)) + "</button></div>";
      else
        h += "<div class='fx-row'><button type='button' class='btn btn-gold' data-fx02act='retry'>" + fxEsc(fxT(FX.f02.tryAgain)) + "</button></div>";
    } else if (rt.phase === "predict"){
      h += fx02McHtml(rt, v.steps[rt.stepIdx].predict);
      h += fx02FbHtml(rt);
    } else { /* study mode after a miss: reveal remaining steps one by one */
      h += fx02FbHtml(rt);
      h += "<div class='fx-row'><button type='button' class='btn btn-line' data-fx02act='reveal'>" + fxEsc(fxT(FX.f02.revealStep)) + "</button></div>";
    }
  } else if (rt.stage === "completion"){
    h += "<p style='font-weight:700'>" + fxEsc(fxT(v.problem)) + "</p>";
    v.shown.forEach(function(s){ h += "<div class='fx-worked-step'>" + fxEsc(fxT(s)) + "</div>"; });
    if (rt.done){
      h += fx02FbHtml(rt);
      if (rec.completedStages.indexOf("completion") >= 0)
        h += "<div class='fx-row'><button type='button' class='btn btn-gold' data-fx02act='next-stage'>" + fxEsc(fxT(FX.f02.nextStage)) + "</button></div>";
      else
        h += "<div class='fx-row'><button type='button' class='btn btn-gold' data-fx02act='retry'>" + fxEsc(fxT(FX.f02.tryAgain)) + "</button></div>";
    } else if (!rt.predOk){
      h += fx02McHtml(rt, v.predict);
      h += fx02FbHtml(rt);
    } else {
      h += "<label style='font-weight:700;display:block;margin:.6rem 0 .3rem' for='fx02Input'>" + fxEsc(fxT(FX.f02.missingStepLabel)) + "</label>";
      h += "<div class='fx-row'><input class='fx-input' id='fx02Input' type='text' autocomplete='off' inputmode='decimal'><button type='button' class='btn btn-gold' data-fx02act='check-step'>" + fxEsc(fxT(FX.f02.submitStep)) + "</button></div>";
      h += fx02FbHtml(rt);
    }
  } else { /* independent */
    h += "<p style='font-weight:700'>" + fxEsc(fxT(v.problem)) + "</p>";
    if (rt.done){
      h += fx02FbHtml(rt);
      if (rec.completedStages.indexOf("independent") >= 0){
        if (fx02InGuidedView(body))
          /* Standalone host: the modal's Learn/Try step buttons do not
             exist here, so finish with concept + lesson actions. */
          h += "<div class='fx-row'><button type='button' class='btn btn-gold' data-fx02act='next-concept'>" + fxEsc(fxT(FX.f02.nextConcept)) + "</button><button type='button' class='btn btn-line' data-fx02act='open-lesson'>" + fxEsc(fxT(FX.f02.openLesson)) + "</button></div>";
        else
          h += "<div class='fx-row'><button type='button' class='btn btn-gold' data-fx02act='go-try'>" + fxEsc(fxT(FX.f02.goTry)) + "</button><button type='button' class='btn btn-line' data-fx02act='go-learn'>" + fxEsc(fxT(FX.f02.goLearn)) + "</button></div>";
      }
      else
        h += "<div class='fx-row'><button type='button' class='btn btn-gold' data-fx02act='retry'>" + fxEsc(fxT(FX.f02.tryAgain)) + "</button><button type='button' class='btn btn-line' data-fx02act='study'>" + fxEsc(fxT(FX.f02.studyAgain)) + "</button></div>";
    } else {
      h += "<label style='font-weight:700;display:block;margin:.6rem 0 .3rem' for='fx02Input'>" + fxEsc(fxT(FX.f02.answerLabel)) + "</label>";
      h += "<div class='fx-row'><input class='fx-input' id='fx02Input' type='text' autocomplete='off' inputmode='decimal'><button type='button' class='btn btn-gold' data-fx02act='check-answer'>" + fxEsc(fxT(FX.f02.submitAnswer)) + "</button></div>";
      h += fx02FbHtml(rt);
    }
  }
  body.innerHTML = h;
  body.querySelectorAll("[data-fx02opt]").forEach(function(b){
    b.addEventListener("click", function(){ fx02AnswerPredict(c, rec, rt, +b.getAttribute("data-fx02opt"), b); });
  });
  body.querySelectorAll("[data-fx02act]").forEach(function(b){
    b.addEventListener("click", function(){ fx02Action(c, rec, rt, b.getAttribute("data-fx02act")); });
  });
  var inp = $("fx02Input");
  if (inp) inp.addEventListener("keydown", function(e){ if (e.key === "Enter"){ e.preventDefault(); fx02Action(c, rec, rt, rt.stage === "completion" ? "check-step" : "check-answer"); } });
}
function fx02CompleteStage(c, rec, stage){
  if (rec.completedStages.indexOf(stage) < 0) rec.completedStages.push(stage);
  var order = ["worked", "completion", "independent"];
  var nx = order[order.indexOf(stage) + 1];
  if (nx) rec.currentStage = nx;
  fx02Save(c, rec);
}
function fx02AnswerPredict(c, rec, rt, idx, btn){
  var mc = rt.stage === "worked" ? rt.variant.steps[rt.stepIdx].predict : rt.variant.predict;
  if (idx === mc.answer){
    btn.classList.add("right");
    if (rt.stage === "worked"){
      rt.revealed = rt.stepIdx + 1;
      rt.stepIdx++;
      rt.fb = { ok: true, text: fxT(FX.f02.correct) };
      if (rt.stepIdx >= rt.variant.steps.length){
        rt.done = true;
        if (rt.clean){ fx02CompleteStage(c, rec, "worked"); rt.fb = { ok: true, text: fxT(FX.f02.workedComplete) }; }
        else rt.fb = { ok: false, text: fxT(FX.f02.incorrect) };
      }
    } else {
      rt.predOk = true;
      rt.fb = { ok: true, text: fxT(FX.f02.correct) };
    }
  } else {
    btn.classList.add("wrong"); btn.disabled = true;
    rt.clean = false;
    if (rt.stage === "worked"){
      rt.fb = { ok: false, text: fxT(FX.f02.incorrect), why: mc.why };
      rt.phase = "study";
      rt.revealed = rt.stepIdx + 1; /* reveal the step to study it */
      rt.stepIdx++;
      if (rt.stepIdx >= rt.variant.steps.length) rt.done = true;
    } else {
      rt.done = true;
      rt.fb = { ok: false, text: fxT(FX.f02.incorrect), why: mc.why };
    }
  }
  fx02RenderBody(c, rec, rt);
  fx02RenderHead(c, rec, rt);
}
function fx02RenderHead(c, rec, rt){
  /* refresh the stage chips without rebuilding the whole card */
  var card = $("fxF02Card"); if (!card) return;
  var chips = card.querySelectorAll(".fx-step");
  var stages = ["worked", "completion", "independent"];
  chips.forEach(function(chip, ix){
    var s = stages[ix]; if (!s) return;
    var st = fx02StageStatus(c, rec, s);
    chip.className = "fx-step " + st;
    chip.textContent = (ix + 1) + ". " + fxT(fx02StageName(s)) + (st === "done" ? " ✓" : (st === "cur" ? " · " + fxT(FX.f02.currentStage) : ""));
  });
}
function fx02Action(c, rec, rt, act){
  if (act === "reveal"){
    rt.revealed = rt.stepIdx + 1; rt.stepIdx++;
    if (rt.stepIdx >= rt.variant.steps.length) rt.done = true;
    rt.fb = null;
    fx02RenderBody(c, rec, rt); return;
  }
  if (act === "retry" || act === "again"){ fx02StartVariant(c, rec, rt.stage); fx02RenderBody(c, rec, fx02Rt); fx02RenderHead(c, rec, fx02Rt); return; }
  if (act === "study"){ rec.currentStage = "worked"; fx02StartVariant(c, rec, "worked"); fx02RenderBody(c, rec, fx02Rt); fx02RenderHead(c, rec, fx02Rt); return; }
  if (act === "next-stage"){
    var order = ["worked", "completion", "independent"];
    var nx = order[order.indexOf(rt.stage) + 1] || "independent";
    fx02StartVariant(c, rec, nx);
    fx02RenderBody(c, rec, fx02Rt); fx02RenderHead(c, rec, fx02Rt); return;
  }
  if (act === "next-concept"){
    var ix = F02_CONCEPTS.indexOf(c);
    fx02ViewConceptId = F02_CONCEPTS[(ix + 1) % F02_CONCEPTS.length].conceptId;
    fx02RenderStandalone();
    var ncard = $("fxF02Card"); if (ncard && ncard.scrollIntoView) ncard.scrollIntoView({ block: "start" });
    return;
  }
  if (act === "open-lesson"){ fx02OpenAndScroll(c.lessonIdx); return; }
  if (act === "go-try"){ var tb = document.querySelector("[data-jstep='try']"); if (tb) tb.click(); return; }
  if (act === "go-learn"){ var lb = document.querySelector("[data-jstep='learn']"); if (lb) lb.click(); if (fx02Card) fx02Card.scrollIntoView({ block: "start" }); return; }
  if (act === "check-step" || act === "check-answer"){
    var inp = $("fx02Input");
    var raw = inp ? inp.value : "";
    if (!String(raw).trim()){ rt.fb = { ok: false, text: fxT(FX.f02.empty) }; fx02RenderBody(c, rec, rt); return; }
    var spec = rt.stage === "completion" ? rt.variant.missing : rt.variant;
    if (fx02Check(spec.accept, raw)){
      rt.done = true;
      fx02CompleteStage(c, rec, rt.stage);
      rt.fb = { ok: true, text: rt.stage === "completion" ? fxT(FX.f02.completionComplete) : fxT(FX.f02.independentComplete), why: spec.why };
    } else {
      rt.done = true; rt.clean = false;
      rt.fb = { ok: false, text: fxT(FX.f02.incorrect), why: spec.why };
    }
    fx02RenderBody(c, rec, rt); fx02RenderHead(c, rec, rt);
    return;
  }
}

/* =====================================================================
   F04 — Five-Minute Mixed Retrieval
   Four ordered slots on Today's Path / Daily Review: due flashcard,
   previously missed problem, older skill, explanation prompt. A slot
   with no honest candidate is marked Unavailable — never backfilled.
   New keys only: vaMixed.v1 (daily sessions) and vaMixedMiss.v1 (miss
   index, seeded from the existing mistake queue's recorded dates).
   The flashcard rating goes through the site's own srsApply + srsSave,
   exactly once, guarded by a persisted rated flag.
   ===================================================================== */
var MIXED_KEY = "vaMixed.v1", MISS_KEY = "vaMixedMiss.v1";
function fxDayOfMs(ms){ var d = new Date(ms); function p(n){ return (n < 10 ? "0" : "") + n; } return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); }
function fxMissLoad(){
  var v = fxGet(MISS_KEY, null);
  if (v && v.version === 1 && v.items && typeof v.items === "object") return v;
  var items = {};
  if (typeof mistState !== "undefined"){
    Object.keys(mistState).forEach(function(k){
      var e = mistState[k]; if (!e || !e.savedAt) return;
      var day = fxDayOfMs(e.savedAt);
      items[k] = { firstDay: day, lastDay: day, count: e.attempts || 1, lastPracticedDay: null };
    });
  }
  var fresh = { version: 1, items: items };
  fxSet(MISS_KEY, fresh);
  return fresh;
}
function fxMissRecord(id, practiced){
  var idx = fxMissLoad();
  var today = fxToday();
  var it = idx.items[id];
  if (!it){ it = idx.items[id] = { firstDay: today, lastDay: today, count: 0, lastPracticedDay: null }; }
  if (practiced){ it.lastPracticedDay = today; }
  else { it.count++; it.lastDay = today; if (!it.firstDay || it.firstDay > today) it.firstDay = today; }
  fxSet(MISS_KEY, idx);
}
(function(){
  if (typeof mistSave === "function"){
    var prevMistSave = mistSave;
    mistSave = function(lid, qi, wrongIdx){
      var r = prevMistSave.apply(this, arguments);
      try { fxMissRecord(lid + "_" + qi, false); } catch(e){}
      return r;
    };
  }
})();
function fxAllCards(){
  var out = [];
  LESSONS.forEach(function(L, lid){ (L.v || []).forEach(function(v, vi){ out.push({ id: lid + "_" + vi, v: v, lid: lid }); }); });
  if (typeof EXTRA_VOCAB !== "undefined" && Array.isArray(EXTRA_VOCAB)){
    EXTRA_VOCAB.forEach(function(x, xi){ out.push({ id: "x" + xi, v: [x.en, x.zh, x.defEn, x.defZh], lid: -1 }); });
  }
  return out;
}
function fxCardById(id){
  var all = fxAllCards();
  for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
  return null;
}
var FX_EXPLAIN = [
  { id: "ex-unit-rate", lid: 0, prompt: ["Explain in your own words: what is a unit rate, and how do you find it?", "用自己的话解释：什么是单位比率？你怎么求出它？"],
    reference: ["A unit rate tells how much of one thing you get for exactly 1 of the other. Find it by dividing the total by the count — for example, $6 for 4 notebooks is $6 ÷ 4 = $1.50 per notebook.", "单位比率表示每 1 份另一样东西能得到多少。用总价除以数量就能求出——例如 4 本笔记本 $6，单价就是 $6 ÷ 4 = 每本 $1.50。"] },
  { id: "ex-abs-value", lid: 1, prompt: ["Explain why |−6| = 6. What does absolute value really mean?", "解释为什么 |−6| = 6。绝对值到底是什么意思？"],
    reference: ["Absolute value is a number's distance from 0 on the number line. −6 is 6 units away from 0, and distance is never negative, so |−6| = 6.", "绝对值是一个数在数轴上到 0 的距离。−6 离 0 有 6 个单位，而距离永远不会是负数，所以 |−6| = 6。"] },
  { id: "ex-frac-percent", lid: 2, prompt: ["Explain how to turn 3/4 into a percent, step by step.", "一步一步解释：怎样把 3/4 变成百分数？"],
    reference: ["Divide 3 by 4 to get the decimal 0.75, then multiply by 100 (or move the decimal point two places right) and add the % sign: 3/4 = 0.75 = 75%.", "先用 3 除以 4 得到小数 0.75，再乘以 100（即小数点向右移两位）并加上 % 号：3/4 = 0.75 = 75%。"] },
  { id: "ex-order-ops", lid: 3, prompt: ["Explain why 2 + 3 × 4 equals 14 and not 20.", "解释为什么 2 + 3 × 4 等于 14 而不是 20。"],
    reference: ["Multiplication is done before addition. First 3 × 4 = 12, then 2 + 12 = 14. Adding first (2 + 3 = 5, then 5 × 4 = 20) breaks the order of operations.", "乘法要先于加法。先算 3 × 4 = 12，再算 2 + 12 = 14。如果先加（2 + 3 = 5，再 5 × 4 = 20），就违反了运算顺序。"] },
  { id: "ex-one-step", lid: 4, prompt: ["Explain how to solve x + 7 = 12, and how you can check your answer.", "解释怎样解 x + 7 = 12，以及怎样检验答案。"],
    reference: ["Undo +7 by subtracting 7 from both sides: x = 12 − 7 = 5. Check by putting 5 back into the equation: 5 + 7 = 12 ✓.", "用两边同时减 7 来抵消 +7：x = 12 − 7 = 5。检验时把 5 代回方程：5 + 7 = 12 ✓。"] },
  { id: "ex-hypothesis", lid: 11, prompt: ["Explain the difference between a hypothesis and a conclusion in an investigation.", "解释在科学探究中，假设和结论有什么区别。"],
    reference: ["A hypothesis is a testable prediction made BEFORE the investigation ('If…, then… because…'). A conclusion is what you decide AFTER collecting data — it says whether the data supported the hypothesis, and why.", "假设是在探究之前提出的可检验的预测（“如果……，那么……，因为……”）。结论是在收集数据之后作出的判断——它说明数据是否支持了假设，以及为什么。"] },
  { id: "ex-proportion", lid: 21, prompt: ["Explain how to tell whether two ratios form a proportion.", "解释怎样判断两个比是否组成比例。"],
    reference: ["Simplify both ratios — if they simplify to the same value, they form a proportion. You can also cross-multiply: for a/b = c/d, check whether a × d equals b × c.", "把两个比都化简——如果化简后相等，就组成比例。也可以交叉相乘：对于 a/b = c/d，检验 a × d 是否等于 b × c。"] },
  { id: "ex-mitochondria", lid: 32, prompt: ["Explain what mitochondria do in a cell, in your own words.", "用自己的话解释线粒体在细胞中起什么作用。"],
    reference: ["Mitochondria release energy from food (glucose) so the cell can do its work — they are often called the cell's powerhouse. This process is cellular respiration.", "线粒体把食物（葡萄糖）中的能量释放出来，供细胞工作——所以常被称为细胞的“发电站”。这个过程叫细胞呼吸。"] }
];
function fxMixedLoad(){
  var v = fxGet(MIXED_KEY, null);
  if (v && v.version === 1 && v.days && typeof v.days === "object") return v;
  return { version: 1, days: {} };
}
function fxMixedSave(store){
  /* bounded history: keep the latest 90 days */
  var keys = Object.keys(store.days).sort();
  while (keys.length > 90){ delete store.days[keys.shift()]; }
  return fxSet(MIXED_KEY, store);
}
function fxJourneyStore(){
  var v = fxGet("vaJourney.v1", null);
  if (v && v.lessons && typeof v.lessons === "object") return v.lessons;
  return {};
}
function fxLessonDoneDay(lid){
  var day = null;
  var e = fxJourneyStore()[String(lid)];
  if (e && e.updatedAt){ var t = Date.parse(e.updatedAt); if (isFinite(t)) day = fxDayOfMs(t); }
  if (!day && typeof p3 !== "undefined"){
    var s = p3[LESSONS[lid].s] && p3[LESSONS[lid].s].s[lid];
    if (s && s.last) day = s.last;
  }
  return day;
}
function fxMixedBuildSession(){
  var store = fxMixedLoad();
  var today = fxToday();
  if (store.days[today]) return store.days[today];
  var slots = [];
  /* 1 — due flashcard: most overdue reviewed card first, then any due card */
  var due = [];
  fxAllCards().forEach(function(card){
    var st = (typeof srsState !== "undefined") ? srsState[card.id] : null;
    if (typeof srsIsDue === "function" && srsIsDue(st, today)) due.push({ card: card, st: st });
  });
  due.sort(function(a, b){
    var ar = a.st && a.st.reviews > 0 ? 0 : 1, br = b.st && b.st.reviews > 0 ? 0 : 1;
    if (ar !== br) return ar - br;
    var ad = (a.st && a.st.due) || "9999", bd = (b.st && b.st.due) || "9999";
    if (ad !== bd) return ad < bd ? -1 : 1;
    return a.card.id < b.card.id ? -1 : 1;
  });
  if (due.length) slots.push({ kind: "flashcard", itemId: due[0].card.id, lessonId: due[0].card.lid, status: "ready" });
  else slots.push({ kind: "flashcard", itemId: null, lessonId: null, status: "unavailable", unavailableReason: "noCandidate" });
  /* 2 — previously missed problem (missed on an earlier day) */
  var missIdx = fxMissLoad();
  var missCands = Object.keys(missIdx.items).filter(function(id){
    var it = missIdx.items[id];
    return it && it.firstDay && it.firstDay < today;
  }).map(function(id){
    var parts = id.split("_");
    return { id: id, lid: +parts[0], qi: +parts[1], rec: missIdx.items[id], open: (typeof mistState !== "undefined" && !!mistState[id]) };
  }).filter(function(c){ return LESSONS[c.lid] && LESSONS[c.lid].q[c.qi]; });
  missCands.sort(function(a, b){
    if (a.open !== b.open) return a.open ? -1 : 1;
    var ap = a.rec.lastPracticedDay || "0000", bp = b.rec.lastPracticedDay || "0000";
    if (ap !== bp) return ap < bp ? -1 : 1;
    if (a.rec.lastDay !== b.rec.lastDay) return a.rec.lastDay < b.rec.lastDay ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });
  var missedSlot = null;
  if (missCands.length){
    missedSlot = { kind: "missed", itemId: missCands[0].id, lessonId: missCands[0].lid, qi: missCands[0].qi, status: "ready" };
    slots.push(missedSlot);
  } else slots.push({ kind: "missed", itemId: null, lessonId: null, status: "unavailable", unavailableReason: "noCandidate" });
  /* 3 — older skill: lesson completed at least 7 days ago */
  var cutoff = (function(){ var d = new Date(); d.setDate(d.getDate() - 7); return fxDayOfMs(d.getTime()); })();
  var olderCands = [];
  LESSONS.forEach(function(L, lid){
    if (typeof doneSet === "undefined" || !doneSet[lid]) return;
    var day = fxLessonDoneDay(lid);
    if (!day || day > cutoff) return;
    olderCands.push({ lid: lid, day: day });
  });
  olderCands.sort(function(a, b){ if (a.day !== b.day) return a.day < b.day ? -1 : 1; return a.lid - b.lid; });
  var olderSlot = null;
  for (var oi = 0; oi < olderCands.length && !olderSlot; oi++){
    var oc = olderCands[oi];
    if (missedSlot && missedSlot.lessonId === oc.lid && olderCands.length > 1) continue;
    var L2 = LESSONS[oc.lid];
    for (var qi2 = 0; qi2 < L2.q.length; qi2++){
      var qid = oc.lid + "_" + qi2;
      if (typeof mistState !== "undefined" && mistState[qid]) continue;
      if (missedSlot && missedSlot.itemId === qid) continue;
      olderSlot = { kind: "older", itemId: qid, lessonId: oc.lid, qi: qi2, status: "ready" };
      break;
    }
  }
  if (olderSlot) slots.push(olderSlot);
  else slots.push({ kind: "older", itemId: null, lessonId: null, status: "unavailable", unavailableReason: "noCandidate" });
  /* 4 — explanation prompt for a studied skill */
  var usedExplain = {};
  Object.keys(store.days).forEach(function(dk){
    if (dk >= cutoff && store.days[dk] && Array.isArray(store.days[dk].slots))
      store.days[dk].slots.forEach(function(s){ if (s.kind === "explain" && s.itemId) usedExplain[s.itemId] = 1; });
  });
  var exCands = FX_EXPLAIN.filter(function(x){ return typeof doneSet !== "undefined" && doneSet[x.lid]; });
  exCands.sort(function(a, b){
    var ad = (missedSlot && missedSlot.lessonId === a.lid) || (olderSlot && olderSlot.lessonId === a.lid) ? 1 : 0;
    var bd = (missedSlot && missedSlot.lessonId === b.lid) || (olderSlot && olderSlot.lessonId === b.lid) ? 1 : 0;
    if (ad !== bd) return ad - bd;
    var au = usedExplain[a.id] ? 1 : 0, bu = usedExplain[b.id] ? 1 : 0;
    if (au !== bu) return au - bu;
    return a.lid - b.lid;
  });
  if (exCands.length) slots.push({ kind: "explain", itemId: exCands[0].id, lessonId: exCands[0].lid, status: "ready" });
  else slots.push({ kind: "explain", itemId: null, lessonId: null, status: "unavailable", unavailableReason: "noCandidate" });
  var avail = slots.filter(function(s){ return s.status !== "unavailable"; }).length;
  var sess = { day: today, createdAt: new Date().toISOString(), catalogVersion: "fx5-1", choiceSeed: vaChoiceSeed(),
    status: avail === 0 ? "nothingAvailable" : "inProgress", slots: slots };
  store.days[today] = sess;
  fxMixedSave(store);
  return sess;
}
var fxMx = { mode: "home", pos: 0, selOpt: -1, revealed: false, checked: false, compared: false };
function fxMxSlotName(kind){
  return kind === "flashcard" ? FX.mixed.slotFlashcard : (kind === "missed" ? FX.mixed.slotMissed : (kind === "older" ? FX.mixed.slotOlder : FX.mixed.slotExplain));
}
function fxMxUnavailText(kind){
  return kind === "flashcard" ? FX.mixed.unFlashcard : (kind === "missed" ? FX.mixed.unMissed : (kind === "older" ? FX.mixed.unOlder : FX.mixed.unExplain));
}
function fxMxAvail(sess){ return sess.slots.filter(function(s){ return s.status !== "unavailable"; }); }
function fxMxDoneCount(sess){ return sess.slots.filter(function(s){ return s.status === "done"; }).length; }
function fxMxSaveSession(sess){
  var store = fxMixedLoad();
  store.days[sess.day] = sess;
  return fxMixedSave(store);
}
function fxRenderMixed(){
  var host = secMixed.querySelector(".fx-host"); if (!host) return;
  var sess;
  try { sess = fxMixedBuildSession(); }
  catch(e){ host.innerHTML = "<div class='fx-card'><p role='alert'>" + fxEsc(fxT(FX.mixed.loadError)) + "</p></div>"; return; }
  if (fxMx.mode === "run") fxMxRenderRun(host, sess);
  else if (fxMx.mode === "results") fxMxRenderResults(host, sess);
  else fxMxRenderHome(host, sess);
}
function fxMxStatusChip(slot){
  if (slot.status === "done") return "<span class='fx-status done'>" + fxEsc(fxT(FX.mixed.done)) + "</span>";
  if (slot.status === "unavailable") return "<span class='fx-status unavail'>" + fxEsc(fxT(FX.mixed.unavailable)) + "</span>";
  return "<span class='fx-status'>" + fxEsc(fxT(FX.mixed.ready)) + "</span>";
}
function fxMxRenderHome(host, sess){
  var avail = fxMxAvail(sess), done = fxMxDoneCount(sess);
  var h = "<div class='fx-card'>";
  h += "<p class='fx-prog' aria-live='polite'>" + fxEsc(fxFill(fxT(FX.mixed.progress), { done: done, available: avail.length })) + "</p>";
  h += "<p class='fx-note'>" + fxEsc(fxFill(fxT(FX.mixed.savedLocally), { learner: fxLearner().name })) + "</p>";
  sess.slots.forEach(function(slot, i){
    h += "<div class='fx-slot'><div class='fx-slot-body'><b>" + (i + 1) + ". " + fxEsc(fxT(fxMxSlotName(slot.kind))) + "</b>";
    if (slot.status === "unavailable") h += "<div class='fx-note'>" + fxEsc(fxT(fxMxUnavailText(slot.kind))) + "</div>";
    else if (slot.lessonId != null && slot.lessonId >= 0 && LESSONS[slot.lessonId])
      h += "<div class='fx-note'>" + fxEsc(fxFill(fxT(FX.mixed.source), { lesson: fxLessonTitle(slot.lessonId), skill: fxT(LESSONS[slot.lessonId].t) })) + "</div>";
    h += "</div>" + fxMxStatusChip(slot) + "</div>";
  });
  if (sess.status === "nothingAvailable" || avail.length === 0)
    h += "<p>" + fxEsc(fxT(FX.mixed.noActivities)) + "</p>";
  else if (done >= avail.length)
    h += "<div class='fx-row' style='margin-top:.8rem'><button type='button' class='btn btn-gold' id='fxMxResults'>" + fxEsc(fxT(FX.mixed.resultsAction)) + "</button></div>";
  else
    h += "<div class='fx-row' style='margin-top:.8rem'><button type='button' class='btn btn-gold' id='fxMxStart'>" + fxEsc(fxT(done > 0 ? FX.mixed.continue : FX.mixed.start)) + "</button></div>";
  h += "</div>";
  host.innerHTML = h;
  var st = $("fxMxStart");
  if (st) st.addEventListener("click", function(){
    fxMx.mode = "run"; fxMx.pos = 0; fxMx.selOpt = -1; fxMx.revealed = false; fxMx.checked = false; fxMx.compared = false;
    fxMxAdvance(sess); fxRenderMixed(); fxScrollTo("dailyreview");
  });
  var rs = $("fxMxResults");
  if (rs) rs.addEventListener("click", function(){ fxMx.mode = "results"; fxRenderMixed(); fxScrollTo("dailyreview"); });
}
function fxMxAdvance(sess){
  var avail = fxMxAvail(sess);
  while (fxMx.pos < avail.length && avail[fxMx.pos].status === "done") fxMx.pos++;
  if (fxMx.pos >= avail.length){ fxMx.mode = "results"; }
  fxMx.selOpt = -1; fxMx.revealed = false; fxMx.checked = false; fxMx.compared = false;
}
function fxMxRenderRun(host, sess){
  var avail = fxMxAvail(sess);
  if (fxMx.pos >= avail.length){ fxMx.mode = "results"; fxMxRenderResults(host, sess); return; }
  var slot = avail[fxMx.pos];
  var h = "<div class='fx-card'>";
  h += "<p class='fx-note'>" + fxEsc(fxFill(fxT(FX.mixed.position), { current: fxMx.pos + 1 })) + " · " + fxEsc(fxT(fxMxSlotName(slot.kind))) + "</p>";
  if (slot.lessonId != null && slot.lessonId >= 0 && LESSONS[slot.lessonId])
    h += "<p class='fx-note'>" + fxEsc(fxFill(fxT(FX.mixed.source), { lesson: fxLessonTitle(slot.lessonId), skill: fxT(LESSONS[slot.lessonId].t) })) + "</p>";
  h += "<div id='fxMxBody'></div>";
  h += "<div class='fx-row' style='margin-top:.9rem'><button type='button' class='btn btn-line' id='fxMxExit'>" + fxEsc(fxT(FX.mixed.exit)) + "</button>";
  if (slot.status === "done") h += "<button type='button' class='btn btn-gold' id='fxMxNext'>" + fxEsc(fxT(FX.mixed.next)) + "</button>";
  h += "</div></div>";
  host.innerHTML = h;
  $("fxMxExit").addEventListener("click", function(){ fxMx.mode = "home"; fxRenderMixed(); fxScrollTo("dailyreview"); });
  var nx = $("fxMxNext");
  if (nx) nx.addEventListener("click", function(){ fxMxAdvance(sess); fxRenderMixed(); });
  var body = $("fxMxBody");
  if (slot.kind === "flashcard") fxMxRunCard(body, sess, slot);
  else if (slot.kind === "explain") fxMxRunExplain(body, sess, slot);
  else fxMxRunProblem(body, sess, slot);
}
function fxMxRunCard(body, sess, slot){
  var card = fxCardById(slot.itemId);
  if (!card){ body.innerHTML = "<p>" + fxEsc(fxT(FX.mixed.missingItem)) + "</p>"; slot.status = "unavailable"; fxMxSaveSession(sess); return; }
  var h = "<p style='font-size:1.25rem;font-weight:800' lang='en'>" + fxEsc(card.v[0]) + "</p>";
  h += "<p lang='zh-Hans' style='font-weight:700'>" + fxEsc(card.v[1]) + "</p>";
  if (!fxMx.revealed){
    h += "<button type='button' class='btn btn-gold' id='fxMxReveal'>" + fxEsc(fxT(FX.mixed.reveal)) + "</button>";
  } else {
    h += "<div class='fx-zhblock'>" + fxH([card.v[2], card.v[3]]) + "</div>";
    /* Illustrated vocab (incl. Batch D): answer side only — the
       illustration is added only in this revealed branch, never in
       the pre-reveal markup above, so neither the image nor its alt
       text can leak the term. Same IMP_ILL data and reserved
       .imp-illu box as the flashcard deck's back face; the alt
       follows the current language via fxT. */
    try {
      var fxIll = (typeof IMP_ILL !== "undefined" && IMP_ILL) ? IMP_ILL[slot.itemId] : null;
      /* Batch E companion: same revealed-branch-only rule — a second
         .imp-illu box beside the diagram's box in a .imp-pair row,
         never in the pre-reveal markup above. Same IMP_COMP data and
         alt rule (fxT) as the flashcard deck's back face. */
      var fxComp = (typeof IMP_COMP !== "undefined" && IMP_COMP) ? IMP_COMP[slot.itemId] : null;
      if (fxIll && fxComp) h += "<span class='imp-pair'><span class='imp-illu'><img src='" + fxEsc(fxIll.p) + "' alt='" + fxEsc(fxT(fxIll.a)) + "' loading='lazy' role='img'></span><span class='imp-illu imp-comp'><img src='" + fxEsc(fxComp.p) + "' alt='" + fxEsc(fxT(fxComp.a)) + "' loading='lazy' role='img'></span></span>";
      else if (fxIll) h += "<span class='imp-illu'><img src='" + fxEsc(fxIll.p) + "' alt='" + fxEsc(fxT(fxIll.a)) + "' loading='lazy' role='img'></span>";
    } catch(e){}
    h += "<p class='fx-note'>" + fxEsc(fxT(FX.mixed.ratingHelp)) + "</p>";
    h += "<div class='fx-row' role='group'>";
    [["again", 1, FX.mixed.again], ["hard", 3, FX.mixed.hard], ["good", 4, FX.mixed.good], ["easy", 5, FX.mixed.easy]].forEach(function(r){
      h += "<button type='button' class='fx-chipbtn' data-fxrate='" + r[1] + "' data-fxratename='" + r[0] + "'>" + fxEsc(fxT(r[2])) + "</button>";
    });
    h += "</div><p class='fx-note' id='fxMxRateMsg' role='status'></p>";
  }
  body.innerHTML = h;
  var rv = $("fxMxReveal");
  if (rv) rv.addEventListener("click", function(){ fxMx.revealed = true; fxMxRenderRun(secMixed.querySelector(".fx-host"), sess); });
  body.querySelectorAll("[data-fxrate]").forEach(function(b){
    b.addEventListener("click", function(){
      if (slot.rated){ return; }
      /* persist the daily completion FIRST, then apply the one SRS rating */
      slot.rated = true; slot.fsrsRating = b.getAttribute("data-fxratename");
      slot.status = "done"; slot.outcome = "rated"; slot.finishedAt = new Date().toISOString();
      if (!fxMxSaveSession(sess)){
        slot.rated = false; slot.status = "ready"; delete slot.fsrsRating; delete slot.outcome;
        var m = $("fxMxRateMsg"); if (m) m.textContent = fxT(FX.mixed.saveError);
        return;
      }
      try {
        srsState[slot.itemId] = srsApply(srsState[slot.itemId], +b.getAttribute("data-fxrate"));
        srsSave();
        if (typeof renderSrsMeta === "function") renderSrsMeta();
      } catch(e){}
      fxRenderMixed();
    });
  });
}
function fxMxRunProblem(body, sess, slot){
  var L = LESSONS[slot.lessonId];
  var q = L && L.q[slot.qi];
  if (!q){ body.innerHTML = "<p>" + fxEsc(fxT(FX.mixed.missingItem)) + "</p>"; slot.status = "unavailable"; fxMxSaveSession(sess); return; }
  var h = "<p style='font-weight:700;font-size:1.05rem'>" + fxH([q[0], q[1]]) + "</p>";
  // Keep canonical option IDs while preserving this daily session's display order.
  vaChoiceOrder(q[2].length, sess.choiceSeed, slot.itemId).forEach(function(i){
    var opt = q[2][i];
    var cls = "fx-opt";
    if (fxMx.checked){ if (i === q[3]) cls += " right"; else if (i === fxMx.selOpt) cls += " wrong"; }
    else if (i === fxMx.selOpt) cls += " right";
    h += "<button type='button' class='" + cls + "' data-fxopt='" + i + "'" + (fxMx.checked ? " disabled" : "") + ">" + fxH(opt) + "</button>";
  });
  if (!fxMx.checked)
    h += "<div class='fx-row'><button type='button' class='btn btn-gold' id='fxMxCheck'>" + fxEsc(fxT(FX.mixed.check)) + "</button></div><p class='fx-note' id='fxMxMsg' role='status'></p>";
  else {
    var ok = slot.outcome === "correct";
    h += "<div class='fx-fb " + (ok ? "ok" : "no") + "' role='status'>" + fxEsc(fxT(ok ? FX.mixed.correct : FX.mixed.incorrect)) +
      "<br><b>" + fxEsc(fxT(FX.mixed.solution)) + ":</b> " + fxH([q[4], q[5]]) + "</div>";
  }
  body.innerHTML = h;
  body.querySelectorAll("[data-fxopt]").forEach(function(b){
    b.addEventListener("click", function(){ fxMx.selOpt = +b.getAttribute("data-fxopt"); fxMxRunProblem(body, sess, slot); fxMxRestoreNext(sess, slot); });
  });
  var ck = $("fxMxCheck");
  if (ck) ck.addEventListener("click", function(){
    if (fxMx.selOpt < 0){ var m = $("fxMxMsg"); if (m) m.textContent = fxT(FX.mixed.answerRequired); return; }
    var correct = fxMx.selOpt === q[3];
    slot.status = "done"; slot.outcome = correct ? "correct" : "incorrect"; slot.finishedAt = new Date().toISOString();
    if (!fxMxSaveSession(sess)){ slot.status = "ready"; delete slot.outcome; var m2 = $("fxMxMsg"); if (m2) m2.textContent = fxT(FX.mixed.saveError); return; }
    try { if (correct) fxMissRecord(slot.itemId, true); else fxMissRecord(slot.itemId, false); } catch(e){}
    fxMx.checked = true;
    fxRenderMixed();
  });
}
function fxMxRestoreNext(sess, slot){ /* keep Next visible after an option re-render inside the run view */ }
function fxMxRunExplain(body, sess, slot){
  var ex = null;
  FX_EXPLAIN.forEach(function(x){ if (x.id === slot.itemId) ex = x; });
  if (!ex){ body.innerHTML = "<p>" + fxEsc(fxT(FX.mixed.missingItem)) + "</p>"; slot.status = "unavailable"; fxMxSaveSession(sess); return; }
  var h = "<p style='font-weight:700;font-size:1.05rem'>" + fxH(ex.prompt) + "</p>";
  h += "<p class='fx-note'>" + fxEsc(fxT(FX.mixed.explainInstruction)) + "</p>";
  h += "<textarea class='fx-textarea' id='fxMxText' placeholder='" + fxEsc(fxT(FX.mixed.explainPlaceholder)) + "' aria-label='" + fxEsc(fxT(FX.mixed.explainPlaceholder)) + "'>" + fxEsc(slot.response || "") + "</textarea>";
  if (!fxMx.compared)
    h += "<div class='fx-row' style='margin-top:.6rem'><button type='button' class='btn btn-gold' id='fxMxCompare'>" + fxEsc(fxT(FX.mixed.showReference)) + "</button></div><p class='fx-note' id='fxMxMsg' role='status'></p>";
  else {
    h += "<div class='fx-zhblock'><b>" + fxEsc(fxT(FX.mixed.reference)) + ":</b><br>" + fxH(ex.reference) + "</div>";
    h += "<p style='font-weight:700'>" + fxEsc(fxT(FX.mixed.selfCheck)) + "</p>";
    h += "<div class='fx-row'><button type='button' class='fx-chipbtn' data-fxself='met'>" + fxEsc(fxT(FX.mixed.met)) + "</button>" +
         "<button type='button' class='fx-chipbtn' data-fxself='needsWork'>" + fxEsc(fxT(FX.mixed.needsWork)) + "</button></div>";
  }
  body.innerHTML = h;
  var ta = $("fxMxText");
  if (ta && fxMx.compared) ta.disabled = true;
  var cp = $("fxMxCompare");
  if (cp) cp.addEventListener("click", function(){
    var txt = ta ? ta.value : "";
    if (!txt.trim()){ var m = $("fxMxMsg"); if (m) m.textContent = fxT(FX.mixed.explanationRequired); return; }
    slot.response = txt;
    fxMxSaveSession(sess);
    fxMx.compared = true;
    fxMxRunExplain(body, sess, slot);
  });
  body.querySelectorAll("[data-fxself]").forEach(function(b){
    b.addEventListener("click", function(){
      slot.status = "done"; slot.outcome = b.getAttribute("data-fxself"); slot.finishedAt = new Date().toISOString();
      fxMxSaveSession(sess);
      fxRenderMixed();
    });
  });
}
function fxMxRenderResults(host, sess){
  var avail = fxMxAvail(sess), done = fxMxDoneCount(sess);
  if (done >= avail.length && sess.status !== "complete"){ sess.status = "complete"; fxMxSaveSession(sess); }
  var h = "<div class='fx-card'><h3>" + fxEsc(fxT(FX.mixed.resultsTitle)) + "</h3>";
  h += "<p>" + fxEsc(fxT(avail.length >= 4 ? FX.mixed.fullResult : FX.mixed.partialResult)) + "</p>";
  sess.slots.forEach(function(slot, i){
    h += "<div class='fx-slot'><div class='fx-slot-body'><b>" + (i + 1) + ". " + fxEsc(fxT(fxMxSlotName(slot.kind))) + "</b>";
    if (slot.status === "done"){
      var out = slot.outcome === "correct" ? FX.mixed.correct : (slot.outcome === "incorrect" ? FX.mixed.incorrect :
        (slot.outcome === "met" ? FX.mixed.met : (slot.outcome === "needsWork" ? FX.mixed.needsWork : FX.mixed.done)));
      h += "<div class='fx-note'>" + fxEsc(fxT(out)) + "</div>";
    } else if (slot.status === "unavailable")
      h += "<div class='fx-note'>" + fxEsc(fxT(fxMxUnavailText(slot.kind))) + "</div>";
    if (slot.status === "done" && slot.lessonId != null && slot.lessonId >= 0 && LESSONS[slot.lessonId] && slot.kind !== "flashcard")
      h += "<div><button type='button' class='fx-revealbtn' data-fxlesson='" + slot.lessonId + "'>" + fxEsc(fxFill(fxT(FX.mixed.reviewLesson), { lesson: fxLessonTitle(slot.lessonId) })) + "</button></div>";
    h += "</div>" + fxMxStatusChip(slot) + "</div>";
  });
  h += "<div class='fx-row' style='margin-top:.8rem'><button type='button' class='btn btn-gold' id='fxMxBack'>" + fxEsc(fxT(FX.mixed.backPath)) + "</button></div></div>";
  host.innerHTML = h;
  var bk = $("fxMxBack");
  if (bk) bk.addEventListener("click", function(){ fxMx.mode = "home"; fxRenderMixed(); fxGoToday(); });
  host.querySelectorAll("[data-fxlesson]").forEach(function(b){
    b.addEventListener("click", function(){ fxOpenLesson(+b.getAttribute("data-fxlesson")); });
  });
}

/* =====================================================================
   F17 — Parent Briefing: Evidence, Next Step, Conversation
   Read-only over existing records. No new storage key: the briefing is
   generated on demand from the mastery-history attempts (dated Check
   results), lesson completion + journey/streak dates, and current
   flashcard due counts. Nothing here writes to any existing key.
   ===================================================================== */
function fxBriefEvents(){
  var events = [], limited = false, seen = {};
  function push(ev){
    var key = ev.kind + "|" + ev.lid + "|" + ev.at + "|" + (ev.c || "") + "/" + (ev.t || "");
    if (seen[key]) return; seen[key] = 1; events.push(ev);
  }
  var mh = fxGet("vaMasteryHistory.v1", null);
  var mhLids = {};
  if (mh && mh.lessons && typeof mh.lessons === "object"){
    Object.keys(mh.lessons).forEach(function(k){
      var lid = +k; if (!LESSONS[lid]) return;
      var rec = mh.lessons[k];
      if (!rec || !Array.isArray(rec.attempts)) return;
      rec.attempts.forEach(function(a){
        if (!a || typeof a.c !== "number" || typeof a.t !== "number" || a.t <= 0 || a.c < 0 || a.c > a.t) return;
        var when = a.recordedAt ? Date.parse(a.recordedAt) : NaN;
        if (!isFinite(when)){ limited = true; return; }
        if (when > Date.now() + 86400000) return;
        mhLids[lid] = 1;
        push({ kind: "check", lid: lid, at: when, c: a.c, t: a.t });
      });
    });
  }
  var va5 = fxGet("vaAssessment.v1", null);
  if (va5 && va5.lessons && typeof va5.lessons === "object"){
    Object.keys(va5.lessons).forEach(function(k){
      var lid = +k; if (!LESSONS[lid] || mhLids[lid]) return;
      var e = va5.lessons[k];
      var lat = e && e.latest;
      if (!lat || typeof lat.c !== "number" || typeof lat.t !== "number" || lat.t <= 0 || lat.c < 0 || lat.c > lat.t) return;
      var when = lat.ts ? Date.parse(lat.ts) : NaN;
      if (!isFinite(when)){ limited = true; return; }
      if (when > Date.now() + 86400000) return;
      push({ kind: "check", lid: lid, at: when, c: lat.c, t: lat.t });
    });
  }
  var checkDay = {};
  events.forEach(function(e){ checkDay[e.lid + "|" + fxDayOfMs(e.at)] = 1; });
  if (typeof doneSet !== "undefined"){
    Object.keys(doneSet).forEach(function(k){
      if (!doneSet[k]) return;
      var lid = +k; if (!LESSONS[lid]) return;
      var day = fxLessonDoneDay(lid);
      if (!day){ limited = true; return; }
      var at = Date.parse(day + "T12:00:00");
      if (!isFinite(at) || at > Date.now() + 86400000) { limited = true; return; }
      if (checkDay[lid + "|" + day]) return;
      push({ kind: "completed", lid: lid, at: at });
    });
  }
  if (typeof srsState !== "undefined"){
    var anyReviews = Object.keys(srsState).some(function(k){ return srsState[k] && srsState[k].reviews > 0; });
    if (anyReviews) limited = true; /* flashcard reviews are real activity but carry no reliable date here */
  }
  events.sort(function(a, b){ return b.at - a.at; });
  return { events: events, limited: limited };
}
function fxBriefSelect(events){
  var picked = [], usedLid = {};
  events.forEach(function(e){ if (e.kind === "check" && !usedLid[e.lid] && picked.length < 3){ picked.push(e); usedLid[e.lid] = 1; } });
  events.forEach(function(e){ if (picked.length >= 3) return; if (picked.indexOf(e) >= 0) return; if (usedLid[e.lid] && e.kind === "completed") return; picked.push(e); usedLid[e.lid] = 1; });
  picked.sort(function(a, b){ return b.at - a.at; });
  return picked.slice(0, 3);
}
function fxBriefDueByLesson(){
  var counts = {};
  if (typeof srsState === "undefined" || typeof srsIsDue !== "function") return counts;
  var today = fxToday();
  LESSONS.forEach(function(L, lid){
    var n = 0;
    (L.v || []).forEach(function(v, vi){ var st = srsState[lid + "_" + vi]; if (st && st.reviews > 0 && srsIsDue(st, today)) n++; });
    if (n > 0) counts[lid] = n;
  });
  return counts;
}
function fxBriefRecommend(events){
  var learner = fxLearner();
  /* 1 — retry a Check with missed questions (most recent latest-per-lesson) */
  var latestCheck = {};
  events.forEach(function(e){ if (e.kind === "check" && (!latestCheck[e.lid] || e.at > latestCheck[e.lid].at)) latestCheck[e.lid] = e; });
  var retryLid = -1, retryAt = -1;
  Object.keys(latestCheck).forEach(function(k){ var e = latestCheck[k]; if (e.c < e.t && e.at > retryAt){ retryAt = e.at; retryLid = e.lid; } });
  if (retryLid >= 0) return { type: "retry", lid: retryLid };
  /* 2 — review due flashcards (deck = lesson with most due reviewed cards) */
  var due = fxBriefDueByLesson();
  var dueLid = -1, dueN = 0;
  Object.keys(due).forEach(function(k){ if (due[k] > dueN || (due[k] === dueN && (+k) < dueLid)){ dueN = due[k]; dueLid = +k; } });
  if (dueLid >= 0) return { type: "cards", lid: dueLid, count: dueN };
  /* 3 — continue a resumable lesson */
  try {
    var jl = fxJourneyStore(), best = null;
    Object.keys(jl).forEach(function(k){
      var lid = +k; if (!LESSONS[lid]) return;
      if (typeof doneSet !== "undefined" && doneSet[lid]) return;
      var e = jl[k]; if (!e || !e.step || e.step === "learn") return;
      var at = e.updatedAt ? Date.parse(e.updatedAt) : 0;
      if (!best || at > best.at) best = { lid: lid, step: e.step, at: at };
    });
    if (best) return { type: "lesson", lid: best.lid, step: best.step };
  } catch(e){}
  /* 4 — a grade-appropriate practice lesson */
  var grade = (typeof pathState !== "undefined" && pathState.grade) ? pathState.grade : 6;
  for (var i = 0; i < LESSONS.length; i++){
    if (LESSONS[i].g === grade && !(typeof doneSet !== "undefined" && doneSet[i])) return { type: "practice", lid: i };
  }
  /* 5 — Today's Path */
  return { type: "path" };
}
var FX_STEP_PAIRS = { learn: ["Learn", "学习"], try: ["Try", "尝试"], check: ["Check", "检查"], review: ["Review", "复习"] };
function fxRenderBriefing(){
  var host = secBrief.querySelector(".fx-host"); if (!host) return;
  var learner = fxLearner();
  var data;
  try { data = fxBriefEvents(); }
  catch(e){
    host.innerHTML = "<div class='fx-card'><p role='alert'>" + fxEsc(fxT(FX.brief.error)) + "</p><button type='button' class='btn btn-gold' id='fxBriefRetry'>" + fxEsc(fxT(FX.brief.retry)) + "</button></div>";
    var rb = $("fxBriefRetry"); if (rb) rb.addEventListener("click", fxRenderBriefing);
    return;
  }
  var picked = fxBriefSelect(data.events);
  var rec = fxBriefRecommend(data.events);
  var h = "<div class='fx-card' role='region' aria-label='" + fxEsc(fxFill(fxT(FX.brief.title), {})) + "'>";
  h += "<p style='margin:0'><b>" + fxEsc(fxFill(fxT(FX.brief.forLearner), { learner: learner.name })) + "</b> · " +
       "<span class='fx-note'>" + fxEsc(fxFill(fxT(FX.brief.asOf), { date: fxDateTimeOf(new Date().toISOString()) })) + "</span></p>";
  h += "<p class='fx-note'>" + fxEsc(fxT(FX.brief.localNotice)) + "</p>";
  h += "<h3>" + fxEsc(fxT(FX.brief.evHeading)) + "</h3>";
  h += "<p class='fx-sub'>" + fxEsc(fxT(FX.brief.evIntro)) + "</p>";
  if (!picked.length){
    h += "<p>" + fxEsc(fxT(FX.brief.evEmpty)) + "</p>";
  } else {
    picked.forEach(function(e){
      var title = fxLessonTitle(e.lid);
      var line;
      if (e.kind === "check") line = fxFill(fxT(FX.brief.evCheck), { activity: title, learner: learner.name, result: e.c + "/" + e.t });
      else line = fxFill(fxT(FX.brief.evCompleted), { learner: learner.name, activity: title });
      h += "<div class='fx-ev'><div class='fx-ev-date'>" + fxEsc(fxDateTimeOf(new Date(e.at).toISOString())) + "</div><div>" + fxEsc(line) + "</div></div>";
    });
  }
  if (data.limited) h += "<p class='fx-note'>" + fxEsc(fxT(FX.brief.evLimited)) + "</p>";
  h += "<h3 style='margin-top:1.2rem'>" + fxEsc(fxT(FX.brief.nextHeading)) + "</h3>";
  h += "<p class='fx-sub'>" + fxEsc(fxT(FX.brief.nextIntro)) + "</p>";
  var recText = "", recWhy = "", ctaLabel = "", convActivity = null, convKind = "generic";
  if (rec.type === "retry"){
    recText = fxFill(fxT(FX.brief.nextRetryCheck), { activity: fxLessonTitle(rec.lid) });
    recWhy = fxT(FX.brief.nextRetryCheckWhy); ctaLabel = fxT(FX.brief.openLesson); convActivity = fxLessonTitle(rec.lid); convKind = "check";
  } else if (rec.type === "cards"){
    recText = fxFill(fxT(FX.brief.nextReviewCards), { activity: fxLessonTitle(rec.lid) });
    recWhy = fxFill(fxT(FX.brief.nextReviewCardsWhy), { count: rec.count }); ctaLabel = fxT(FX.brief.openFlashcards); convActivity = fxLessonTitle(rec.lid); convKind = "cards";
  } else if (rec.type === "lesson"){
    recText = fxFill(fxT(FX.brief.nextFinishLesson), { activity: fxLessonTitle(rec.lid), result: fxT(FX_STEP_PAIRS[rec.step] || FX_STEP_PAIRS.learn) });
    recWhy = fxT(FX.brief.nextFinishLessonWhy); ctaLabel = fxT(FX.brief.openLesson); convActivity = fxLessonTitle(rec.lid); convKind = "lesson";
  } else if (rec.type === "practice"){
    recText = fxFill(fxT(FX.brief.nextTryPractice), { activity: fxLessonTitle(rec.lid) });
    recWhy = fxT(FX.brief.nextTryPracticeWhy); ctaLabel = fxT(FX.brief.openPractice); convActivity = fxLessonTitle(rec.lid); convKind = "lesson";
  } else {
    recText = fxT(FX.brief.nextStartPath); recWhy = fxT(FX.brief.nextStartPathWhy); ctaLabel = fxT(FX.brief.openPath);
    if (picked.length) { convActivity = fxLessonTitle(picked[0].lid); convKind = "lesson"; }
  }
  h += "<div class='fx-ev'><div>" + fxEsc(recText) + "</div><div class='fx-note'>" + fxEsc(recWhy) + "</div>" +
       "<div class='fx-row' style='margin-top:.6rem'><button type='button' class='btn btn-gold' id='fxBriefCta'>" + fxEsc(ctaLabel) + "</button></div></div>";
  h += "<h3 style='margin-top:1.2rem'>" + fxEsc(fxT(FX.brief.convHeading)) + "</h3>";
  h += "<p class='fx-sub'>" + fxEsc(fxT(FX.brief.convIntro)) + "</p>";
  var prompts = [];
  if (convKind === "check"){ prompts = [FX.brief.convExplain, FX.brief.convChallenge]; }
  else if (convKind === "cards"){ prompts = [FX.brief.convReview, FX.brief.convExplain]; }
  else if (convKind === "lesson"){ prompts = [FX.brief.convExplain, FX.brief.convChallenge]; }
  if (convActivity) prompts.forEach(function(p){ h += "<p style='margin:.45rem 0'>" + fxEsc(fxFill(fxT(p), { activity: convActivity })) + "</p>"; });
  else h += "<p style='margin:.45rem 0'>" + fxEsc(fxT(FX.brief.convGeneric)) + "</p>";
  h += "<p class='fx-note' style='margin-top:1rem'>" + fxEsc(fxT(FX.brief.footer)) + "</p>";
  h += "</div>";
  host.innerHTML = h;
  var cta = $("fxBriefCta");
  if (cta) cta.addEventListener("click", function(){
    if (rec.type === "retry" || rec.type === "lesson" || rec.type === "practice"){
      if (LESSONS[rec.lid]) fxOpenLesson(rec.lid);
      else { cta.textContent = fxT(FX.brief.unavailable); fxScrollTo("today"); }
    } else if (rec.type === "cards"){
      try { lastLessonIdx = rec.lid; } catch(e){}
      var fb = document.querySelector("[data-fscope='lesson']");
      if (fb) fb.click();
      var fm = document.querySelector("[data-fmode='due']");
      if (fm) fm.click();
      fxGoFlash();
    } else fxScrollTo("today");
  });
}

/* =====================================================================
   F11 — Session Builder
   Time / energy / focus → a bounded plan (estimates sum to at most the
   chosen minutes − 1; at most 3 items, 2 on Low energy). Reads lesson
   journey state and SRS due state; writes ONLY vaSessionBuilder.v1.
   Building, opening, skipping or stopping a plan never rates a card
   and never completes a lesson.
   ===================================================================== */
var SESS_KEY = "vaSessionBuilder.v1";
var fx11View = "configure";
var fx11Preview = null;
var fx11ConfirmReplace = false;
function fx11Load(){
  var v = fxGet(SESS_KEY, null);
  if (v && v.schemaVersion === 1 && v.choices && typeof v.choices === "object")
    return { schemaVersion: 1, choices: { minutes: [5, 10, 15, 20, 30, 45].indexOf(v.choices.minutes) >= 0 ? v.choices.minutes : 15,
      energy: ["low", "medium", "high"].indexOf(v.choices.energy) >= 0 ? v.choices.energy : "medium",
      focus: ["balanced", "learn", "practice", "review"].indexOf(v.choices.focus) >= 0 ? v.choices.focus : "balanced" },
      session: (v.session && typeof v.session === "object" && Array.isArray(v.session.items)) ? v.session : null };
  return { schemaVersion: 1, choices: { minutes: 15, energy: "medium", focus: "balanced" }, session: null };
}
function fx11Save(rec){ return fxSet(SESS_KEY, rec); }
function fx11StepEst(step){ return step === "learn" ? 8 : (step === "try" ? 6 : 5); }
function fx11Candidates(){
  var out = [];
  var today = fxToday();
  var due = [];
  fxAllCards().forEach(function(card){
    var st = (typeof srsState !== "undefined") ? srsState[card.id] : null;
    if (typeof srsIsDue === "function" && srsIsDue(st, today)) due.push({ card: card, st: st });
  });
  due.sort(function(a, b){
    var ar = a.st && a.st.reviews > 0 ? 0 : 1, br = b.st && b.st.reviews > 0 ? 0 : 1;
    if (ar !== br) return ar - br;
    var ad = (a.st && a.st.due) || "9999", bd = (b.st && b.st.due) || "9999";
    return ad !== bd ? (ad < bd ? -1 : 1) : (a.card.id < b.card.id ? -1 : 1);
  });
  if (due.length){
    var batch = due.slice(0, 5);
    var base = {};
    batch.forEach(function(d){ base[d.card.id] = d.st ? (d.st.reviews || 0) : 0; });
    out.push({ kind: "cards", cardIds: batch.map(function(d){ return d.card.id; }), est: 1 + batch.length, reason: "due", group: 0, baseReviews: base });
  }
  LESSONS.forEach(function(L, lid){
    var entry = fxJourneyStore()[String(lid)];
    var step = (entry && entry.step) ? entry.step : "learn", group = 2, reason = "start";
    var started = !!entry;
    if (typeof doneSet !== "undefined" && doneSet[lid]){ step = "review"; group = 3; reason = "due"; }
    else if (started){ group = 1; reason = "continue"; }
    out.push({ kind: "lesson", lessonId: lid, step: step, est: fx11StepEst(step), reason: reason, group: group });
  });
  return out;
}
function fx11KindOf(item){ return item.kind === "cards" ? "review" : item.step; }
function fx11Eligible(item, choices){
  var k = fx11KindOf(item);
  if (choices.energy === "low" && !(item.kind === "cards" || k === "review" || k === "try")) return false;
  if (choices.focus === "learn" && k !== "learn") return false;
  if (choices.focus === "practice" && !(k === "try" || k === "check")) return false;
  if (choices.focus === "review" && !(item.kind === "cards" || k === "review")) return false;
  return true;
}
function fx11BuildPlan(choices){
  var cands = fx11Candidates().filter(function(it){ return fx11Eligible(it, choices); });
  cands.sort(function(a, b){
    if (choices.focus === "review"){
      var ag = a.kind === "cards" ? 0 : (a.group === 3 ? 1 : a.group), bg = b.kind === "cards" ? 0 : (b.group === 3 ? 1 : b.group);
      if (ag !== bg) return ag - bg;
    } else if (choices.focus === "balanced"){
      if (a.group !== b.group) return a.group - b.group;
    } else {
      var ag2 = a.group === 1 ? 0 : (a.group === 2 ? 1 : a.group), bg2 = b.group === 1 ? 0 : (b.group === 2 ? 1 : b.group);
      if (ag2 !== bg2) return ag2 - bg2;
    }
    var al = a.kind === "lesson" ? a.lessonId : -1, bl = b.kind === "lesson" ? b.lessonId : -1;
    return al - bl;
  });
  var usable = choices.minutes - 1;
  var maxItems = choices.energy === "low" ? 2 : 3;
  var plan = [], total = 0;
  for (var i = 0; i < cands.length && plan.length < maxItems; i++){
    if (total + cands[i].est <= usable){ plan.push(cands[i]); total += cands[i].est; }
  }
  return { items: plan, total: total };
}
function fx11TypePair(item){
  if (item.kind === "cards") return FX.sess.typeReview;
  return item.step === "learn" ? FX.sess.typeLearn : (item.step === "try" ? FX.sess.typeTry : (item.step === "check" ? FX.sess.typeCheck : FX.sess.typeReview));
}
function fx11ReasonPair(item){
  return item.reason === "due" ? FX.sess.reasonDue : (item.reason === "continue" ? FX.sess.reasonContinue : FX.sess.reasonStart);
}
function fx11ItemTitle(item){
  return item.kind === "cards" ? fxT(FX.sess.flashcards) : fxLessonTitle(item.lessonId);
}
function fx11Confirmed(item, sess){
  if (item.kind === "cards"){
    return item.cardIds.every(function(id){
      var st = (typeof srsState !== "undefined") ? srsState[id] : null;
      return st && (st.reviews || 0) > ((item.baseReviews && item.baseReviews[id]) || 0);
    });
  }
  if (typeof doneSet !== "undefined" && doneSet[item.lessonId] && item.step !== "review") return true;
  try {
    var e = fxJourneyStore()[String(item.lessonId)];
    if (!e) return false;
    var order = ["learn", "try", "check", "review"];
    if (item.step === "review"){
      if (!(typeof doneSet !== "undefined" && doneSet[item.lessonId])) return false;
      var at = e.updatedAt ? Date.parse(e.updatedAt) : 0;
      return at > Date.parse(sess.startedAt || 0);
    }
    return order.indexOf(e.step) > order.indexOf(item.step);
  } catch(e){}
  return false;
}
function fx11Elapsed(sess){
  var ms = sess.activeMs || 0;
  if (sess.activeSince && !document.hidden) ms += Date.now() - Date.parse(sess.activeSince);
  return ms;
}
function fxRenderSession(){
  var host = secSess.querySelector(".fx-host"); if (!host) return;
  var rec = fx11Load();
  var ch = rec.choices;
  if (rec.session && rec.session.status === "active" && fx11View !== "configure-new") fx11RenderActive(host, rec);
  else if (rec.session && rec.session.status === "finished" && fx11View === "summary") fx11RenderSummary(host, rec);
  else fx11RenderConfigure(host, rec);
}
function fx11ChipRow(labelPair, values, current, attr){
  var h = "<p style='font-weight:800;margin:.9rem 0 .35rem'>" + fxEsc(fxT(labelPair)) + "</p><div class='fx-row' role='radiogroup' aria-label='" + fxEsc(fxT(labelPair)) + "'>";
  values.forEach(function(v){
    h += "<button type='button' class='fx-chipbtn' role='radio' aria-checked='" + (String(current) === String(v.value) ? "true" : "false") + "' data-fx11" + attr + "='" + v.value + "'>" + fxEsc(v.label) + "</button>";
  });
  return h + "</div>";
}
function fx11RenderConfigure(host, rec){
  var ch = rec.choices;
  var h = "<div class='fx-card'>";
  if (rec.session && rec.session.status === "active"){
    h += "<p><b>" + fxEsc(fxT(FX.sess.resume)) + "</b></p>";
    h += "<div class='fx-row'><button type='button' class='btn btn-gold' id='fx11Resume'>" + fxEsc(fxT(FX.sess.resume)) + "</button>" +
         "<button type='button' class='btn btn-line' id='fx11New'>" + fxEsc(fxT(FX.sess.newPlan)) + "</button></div>";
    if (fx11ConfirmReplace)
      h += "<p role='alert' style='margin-top:.7rem'>" + fxEsc(fxT(FX.sess.replaceConfirm)) + "</p>" +
           "<div class='fx-row'><button type='button' class='btn btn-gold' id='fx11Replace'>" + fxEsc(fxT(FX.sess.replace)) + "</button>" +
           "<button type='button' class='btn btn-line' id='fx11CancelReplace'>" + fxEsc(fxT(FX.sess.cancel)) + "</button></div>";
    h += "</div>";
    host.innerHTML = h;
    $("fx11Resume").addEventListener("click", function(){ fx11View = "session"; fxRenderSession(); fxScrollTo("sessionbuilder"); });
    $("fx11New").addEventListener("click", function(){ fx11ConfirmReplace = true; fxRenderSession(); });
    var rp = $("fx11Replace");
    if (rp) rp.addEventListener("click", function(){
      rec.session.status = "replaced"; rec.session.endedAt = new Date().toISOString(); rec.session.activeSince = null;
      fx11Save(rec); fx11ConfirmReplace = false; fx11View = "configure-new"; fx11Preview = null; fxRenderSession();
    });
    var cr = $("fx11CancelReplace");
    if (cr) cr.addEventListener("click", function(){ fx11ConfirmReplace = false; fxRenderSession(); });
    return;
  }
  h += fx11ChipRow(FX.sess.timeLabel, [5, 10, 15, 20, 30, 45].map(function(m){ return { value: m, label: fxFill(fxT(FX.sess.minuteChoice), { count: m }) }; }), ch.minutes, "time");
  h += fx11ChipRow(FX.sess.energyLabel, [
    { value: "low", label: fxT(FX.sess.energyLow) }, { value: "medium", label: fxT(FX.sess.energyMedium) }, { value: "high", label: fxT(FX.sess.energyHigh) }], ch.energy, "energy");
  h += fx11ChipRow(FX.sess.focusLabel, [
    { value: "balanced", label: fxT(FX.sess.focusBalanced) }, { value: "learn", label: fxT(FX.sess.focusLearn) },
    { value: "practice", label: fxT(FX.sess.focusPractice) }, { value: "review", label: fxT(FX.sess.focusReview) }], ch.focus, "focus");
  h += "<p class='fx-note'>" + fxEsc(fxT(FX.sess.estimateNote)) + "</p>";
  h += "<div class='fx-row'><button type='button' class='btn btn-gold' id='fx11Build'>" + fxEsc(fxT(FX.sess.build)) + "</button>" +
       "<a class='btn btn-line' href='#today'>" + fxEsc(fxT(FX.sess.backToday)) + "</a></div>";
  h += "<div id='fx11PlanHost' style='margin-top:1rem'></div></div>";
  host.innerHTML = h;
  host.querySelectorAll("[data-fx11time]").forEach(function(b){ b.addEventListener("click", function(){ rec.choices.minutes = +b.getAttribute("data-fx11time"); fx11Save(rec); fx11Preview = null; fxRenderSession(); }); });
  host.querySelectorAll("[data-fx11energy]").forEach(function(b){ b.addEventListener("click", function(){ rec.choices.energy = b.getAttribute("data-fx11energy"); fx11Save(rec); fx11Preview = null; fxRenderSession(); }); });
  host.querySelectorAll("[data-fx11focus]").forEach(function(b){ b.addEventListener("click", function(){ rec.choices.focus = b.getAttribute("data-fx11focus"); fx11Save(rec); fx11Preview = null; fxRenderSession(); }); });
  $("fx11Build").addEventListener("click", function(){
    fx11Preview = fx11BuildPlan(rec.choices);
    fx11RenderPlan($("fx11PlanHost"), rec, fx11Preview);
  });
  if (fx11Preview) fx11RenderPlan($("fx11PlanHost"), rec, fx11Preview);
}
function fx11RenderPlan(hostEl, rec, plan){
  if (!hostEl) return;
  var h = "<h3>" + fxEsc(fxT(FX.sess.planTitle)) + "</h3>";
  h += "<p class='fx-prog'>" + fxEsc(fxFill(fxT(FX.sess.estimatedTotal), { minutes: plan.total, budget: rec.choices.minutes })) + "</p>";
  if (!plan.items.length){
    h += "<p><b>" + fxEsc(fxT(FX.sess.emptyTitle)) + "</b></p><p class='fx-sub'>" + fxEsc(fxT(FX.sess.emptyBody)) + "</p>";
  } else {
    plan.items.forEach(function(item, i){
      h += "<div class='fx-sess-item'><span class='fx-sess-num' aria-hidden='true'>" + (i + 1) + "</span><div class='fx-slot-body'>" +
        "<b>" + fxEsc(fx11ItemTitle(item)) + "</b> · " + fxEsc(fxT(fx11TypePair(item))) +
        "<div class='fx-note'>" + fxEsc(item.kind === "cards" ? fxFill(fxT(FX.sess.cardCount), { count: item.cardIds.length }) : fxFill(fxT(FX.sess.itemEstimate), { minutes: item.est })) +
        " · " + fxEsc(fxT(fx11ReasonPair(item))) + "</div></div></div>";
    });
    h += "<div class='fx-row' style='margin-top:.7rem'><button type='button' class='btn btn-gold' id='fx11Start'>" + fxEsc(fxT(FX.sess.start)) + "</button>" +
         "<button type='button' class='btn btn-line' id='fx11Change'>" + fxEsc(fxT(FX.sess.change)) + "</button></div>";
  }
  h += "<p class='fx-note' id='fx11Err' role='alert'></p>";
  hostEl.innerHTML = h;
  var st = $("fx11Start");
  if (st) st.addEventListener("click", function(){
    /* revalidate: rebuild; if the plan changed, show the revised plan first */
    var fresh = fx11BuildPlan(rec.choices);
    var same = JSON.stringify(fresh.items.map(function(x){ return x.kind + ":" + (x.lessonId || "") + ":" + (x.step || "") + ":" + (x.cardIds || []).join(","); })) ===
               JSON.stringify(plan.items.map(function(x){ return x.kind + ":" + (x.lessonId || "") + ":" + (x.step || "") + ":" + (x.cardIds || []).join(","); }));
    if (!same){ fx11Preview = fresh; fx11RenderPlan(hostEl, rec, fresh); return; }
    rec.session = { id: "s" + Date.now().toString(36), status: "active", startedAt: new Date().toISOString(),
      activeMs: 0, activeSince: document.hidden ? null : new Date().toISOString(), currentIndex: 0,
      items: fresh.items.map(function(x){ var y = {}; Object.keys(x).forEach(function(k){ y[k] = x[k]; }); y.status = "pending"; return y; }) };
    if (!fx11Save(rec)){ var e = $("fx11Err"); if (e) e.textContent = fxT(FX.sess.storageError); rec.session = null; return; }
    fx11View = "session"; fx11Preview = null;
    fxRenderSession(); fxScrollTo("sessionbuilder");
  });
  var cg = $("fx11Change");
  if (cg) cg.addEventListener("click", function(){ fx11Preview = null; fxRenderSession(); fxScrollTo("sessionbuilder"); });
}
function fx11RenderActive(host, rec){
  var sess = rec.session;
  if (!sess.activeSince && !document.hidden){ sess.activeSince = new Date().toISOString(); fx11Save(rec); }
  /* reconcile confirmations for display */
  var cur = sess.items[sess.currentIndex];
  var h = "<div class='fx-card'><h3>" + fxEsc(fxT(FX.sess.planTitle)) + "</h3>";
  h += "<p class='fx-note' id='fx11Elapsed'>" + fxEsc(fxFill(fxT(FX.sess.elapsed), { minutes: Math.floor(fx11Elapsed(sess) / 60000) })) + " · " +
       fxEsc(fxFill(fxT(FX.sess.estimatedTotal), { minutes: sess.items.reduce(function(a, x){ return a + x.est; }, 0), budget: rec.choices.minutes })) + "</p>";
  if (fx11Elapsed(sess) >= rec.choices.minutes * 60000)
    h += "<p class='fx-fb ok' role='status'>" + fxEsc(fxT(FX.sess.timeReached)) + "</p>";
  if (!cur || sess.items.every(function(x){ return x.status === "done" || x.status === "skipped" || x.status === "unavailable"; })){
    sess.status = "finished"; sess.endedAt = new Date().toISOString(); sess.activeSince = null;
    sess.activeMs = fx11Elapsed(sess); fx11Save(rec);
    fx11View = "summary"; fx11RenderSummary(host, rec); return;
  }
  h += "<p class='fx-prog'>" + fxEsc(fxFill(fxT(FX.sess.itemNumber), { current: sess.currentIndex + 1, total: sess.items.length })) + "</p>";
  sess.items.forEach(function(item, i){
    var isCur = i === sess.currentIndex;
    h += "<div class='fx-sess-item'" + (isCur ? "" : " style='opacity:.75'") + "><span class='fx-sess-num' aria-hidden='true'>" + (i + 1) + "</span><div class='fx-slot-body'>" +
      "<b>" + fxEsc(fx11ItemTitle(item)) + "</b> · " + fxEsc(fxT(fx11TypePair(item))) +
      " <span class='fx-status" + (item.status === "done" ? " done" : (item.status === "unavailable" ? " unavail" : "")) + "'>" +
      fxEsc(item.status === "done" ? fxT(FX.mixed.done) : (item.status === "skipped" ? fxT(FX.sess.skip) : (item.status === "unavailable" ? fxT(FX.mixed.unavailable) : fxFill(fxT(FX.sess.itemEstimate), { minutes: item.est })))) + "</span>" +
      "<div class='fx-note'>" + fxEsc(fxT(fx11ReasonPair(item))) + "</div>";
    if (isCur && item.status !== "done" && item.status !== "skipped"){
      var confirmed = fx11Confirmed(item, sess);
      h += "<div class='fx-row' style='margin-top:.5rem'>" +
        "<button type='button' class='btn btn-gold' data-fx11act='open'>" + fxEsc(fxT(confirmed ? FX.sess.done : FX.sess.continueAct)) + "</button>" +
        "<button type='button' class='btn btn-line' data-fx11act='skip'>" + fxEsc(fxT(FX.sess.skip)) + "</button></div>";
      if (!confirmed) h += "<p class='fx-note'>" + fxEsc(fxT(FX.sess.open)) + ": " + fxEsc(fx11ItemTitle(item)) + "</p>";
    }
    h += "</div></div>";
  });
  h += "<div class='fx-row' style='margin-top:.8rem'><button type='button' class='btn btn-line' id='fx11Stop'>" + fxEsc(fxT(FX.sess.stop)) + "</button>" +
       "<a class='btn btn-line' href='#today'>" + fxEsc(fxT(FX.sess.backToday)) + "</a></div></div>";
  host.innerHTML = h;
  host.querySelectorAll("[data-fx11act]").forEach(function(b){
    b.addEventListener("click", function(){
      var act = b.getAttribute("data-fx11act");
      var item = sess.items[sess.currentIndex];
      if (act === "skip"){ item.status = "skipped"; fx11AdvanceSession(sess); fx11Save(rec); fxRenderSession(); return; }
      if (act === "open"){
        if (fx11Confirmed(item, sess)){ item.status = "done"; fx11AdvanceSession(sess); fx11Save(rec); fxRenderSession(); return; }
        item.status = "opened"; fx11Save(rec);
        if (item.kind === "cards"){
          var fm = document.querySelector("[data-fmode='due']"); if (fm) fm.click();
          fxGoFlash();
        } else if (LESSONS[item.lessonId]) fxOpenLesson(item.lessonId);
        else { item.status = "unavailable"; fx11Save(rec); fxRenderSession(); }
      }
    });
  });
  var stop = $("fx11Stop");
  if (stop) stop.addEventListener("click", function(){
    sess.status = "finished"; sess.endedAt = new Date().toISOString();
    sess.activeMs = fx11Elapsed(sess); sess.activeSince = null;
    fx11Save(rec); fx11View = "summary"; fxRenderSession(); fxScrollTo("sessionbuilder");
  });
}
function fx11AdvanceSession(sess){
  while (sess.currentIndex < sess.items.length && (sess.items[sess.currentIndex].status === "done" || sess.items[sess.currentIndex].status === "skipped" || sess.items[sess.currentIndex].status === "unavailable")) sess.currentIndex++;
}
function fx11RenderSummary(host, rec){
  var sess = rec.session;
  var done = sess.items.filter(function(x){ return x.status === "done"; }).length;
  var skipped = sess.items.filter(function(x){ return x.status === "skipped"; }).length;
  var h = "<div class='fx-card'><h3>" + fxEsc(fxT(FX.sess.completeTitle)) + "</h3>";
  h += "<p class='fx-prog'>" + fxEsc(fxFill(fxT(FX.sess.completeCount), { done: done, skipped: skipped })) + "</p>";
  h += "<div class='fx-row'><button type='button' class='btn btn-gold' id='fx11Another'>" + fxEsc(fxT(FX.sess.buildAnother)) + "</button>" +
       "<a class='btn btn-line' href='#today'>" + fxEsc(fxT(FX.sess.backToday)) + "</a></div></div>";
  host.innerHTML = h;
  $("fx11Another").addEventListener("click", function(){ fx11View = "configure-new"; fx11Preview = null; fxRenderSession(); fxScrollTo("sessionbuilder"); });
}
/* active-time accounting: visible tab only */
var fx11LastTick = Date.now();
setInterval(function(){
  var now = Date.now();
  var rec = fx11Load();
  if (rec.session && rec.session.status === "active" && !document.hidden){
    if (!rec.session.activeSince) rec.session.activeSince = new Date(now - (now - fx11LastTick > 30000 ? 0 : now - fx11LastTick)).toISOString();
    if ((now - fx11LastTick) >= 20000){ rec.session.activeMs = fx11Elapsed(rec.session); rec.session.activeSince = new Date().toISOString(); fx11Save(rec); }
  }
  fx11LastTick = now;
}, 5000);
document.addEventListener("visibilitychange", function(){
  var rec = fx11Load();
  if (rec.session && rec.session.status === "active"){
    if (document.hidden){ rec.session.activeMs = fx11Elapsed(rec.session); rec.session.activeSince = null; }
    else rec.session.activeSince = new Date().toISOString();
    fx11Save(rec);
  }
});

/* ---------------- lesson-fill hook + today extras + global render ---------------- */
function fxOnLesson(lid){
  try { fxBridgeAfterFill(lid); } catch(e){}
  try { fx02Render(lid); } catch(e){}
  try { fxApplyExamGate(); } catch(e){}
}
(function(){
  if (typeof fillModal === "function"){
    var prevFill = fillModal;
    fillModal = function(i, k){ var r = prevFill.apply(this, arguments); try { fxOnLesson(i); } catch(e){} return r; };
  }
})();
/* Open a guided-practice lesson and bring its F02 card into view: the
   card sits at the end of the Learn step, so opening the lesson alone
   leaves it far below the fold. fillModal (and with it fx02Render) runs
   synchronously inside openLesson, so the card exists after a tick. */
function fx02OpenAndScroll(lid){
  fxOpenLesson(lid);
  setTimeout(function(){
    var card = $("fxF02Card");
    if (card && card.scrollIntoView) card.scrollIntoView({ block: "start" });
  }, 450);
}
function fxRenderTodayExtra(){
  if (!fxTodayExtra) return;
  var h = "";
  /* F04 card */
  var sess = null;
  try { sess = fxMixedBuildSession(); } catch(e){}
  h += "<div class='fx-card' style='margin:0'><h3>" + fxEsc(fxT(FX.mixed.title)) + "</h3>" +
       "<p class='fx-sub'>" + fxEsc(fxT(FX.mixed.description)) + "</p>";
  if (sess){
    var avail = fxMxAvail(sess), done = fxMxDoneCount(sess);
    h += "<p class='fx-prog'>" + fxEsc(fxFill(fxT(FX.mixed.progress), { done: done, available: avail.length })) + "</p>" +
         "<a class='btn btn-gold fx-bigbtn' href='#dailyreview'>" + fxEsc(fxT(done >= avail.length && avail.length ? FX.mixed.resultsAction : (done > 0 ? FX.mixed.continue : FX.mixed.start))) + "</a>";
  }
  h += "</div>";
  /* F11 card */
  h += "<div class='fx-card' style='margin:0'><h3>" + fxEsc(fxT(FX.sess.title)) + "</h3>" +
       "<p class='fx-sub'>" + fxEsc(fxT(FX.sess.intro)) + "</p>" +
       "<a class='btn btn-gold fx-bigbtn' href='#sessionbuilder'>" + fxEsc(fxT(FX.sess.todayAction)) + "</a></div>";
  /* F02 card — ALWAYS shown, not only once a concept is in progress.
     Guided practice lives at the end of Step 1 · Learn inside just four
     lessons; with no entry point here it was undiscoverable (a tester
     could not find it). List every concept with its status and a button
     that opens the lesson scrolled straight to the practice card. */
  h += "<div class='fx-card' style='margin:0'><h3>" + fxEsc(fxT(FX.f02.title)) + "</h3>" +
       "<p class='fx-sub'>" + fxEsc(fxT(FX.f02.description)) + "</p>";
  F02_CONCEPTS.forEach(function(c){
    var r = fx02Load(c);
    var doneAll = r.completedStages.length >= 3;
    var started = r.completedStages.length > 0;
    var status = doneAll ? fxT(FX.f02.completed) : (started ? fxT(fx02StageName(r.currentStage)) : fxT(FX.f02.notStarted));
    h += "<div class='fx-row' style='justify-content:space-between'><span>" + fxEsc(fxLessonTitle(c.lessonIdx)) + " · " + fxEsc(status) + "</span>" +
         "<button type='button' class='btn btn-line' data-fx02open='" + c.lessonIdx + "'>" + fxEsc(fxT(started ? FX.f02.continue : FX.f02.start)) + "</button></div>";
  });
  h += "</div>";
  fxTodayExtra.innerHTML = h;
  fxTodayExtra.querySelectorAll("[data-fx02open]").forEach(function(b){
    b.addEventListener("click", function(){ fx02OpenAndScroll(+b.getAttribute("data-fx02open")); });
  });
}
function fxRefreshHeads(){
  [secMixed, secBrief, secSess].forEach(function(s){
    if (!s || !s._fxHead) return;
    s.querySelector(".fx-eyebrow").textContent = fxT(s._fxHead.eyebrow);
    s.querySelector("h2").textContent = fxT(s._fxHead.title);
    s.querySelector(".fx-secsub").textContent = fxT(s._fxHead.sub);
  });
  (window.__fxNavLinks || []).forEach(function(a){ a.textContent = fxT(a._fxPair); });
  var tb = $("fxTermBtn"); if (tb) tb.textContent = fxT(FX.terms.open);
  var bh = $("fxBridgeSettingsH"); if (bh) bh.textContent = fxT(FX.bridge.settingsHeading);
}
var fxRenderTimer = null;
function fxRenderAll(){
  if (fxRenderTimer) return;
  fxRenderTimer = setTimeout(function(){
    fxRenderTimer = null;
    try { fxRefreshHeads(); } catch(e){}
    try { fxRenderBridgeControls(); } catch(e){}
    try { fxRenderTodayExtra(); } catch(e){}
    try { fx02SyncStandaloneSafe(); } catch(e){}
    if (fxMx.mode !== "run"){ try { fxRenderMixed(); } catch(e){} }
    try { fxRenderBriefing(); } catch(e){}
    try { fxRenderSession(); } catch(e){}
    try { fxApplyExamGate(); } catch(e){}
  }, 30);
}
["langEn", "langZh", "langBi"].forEach(function(id){
  var b = $(id);
  if (b) b.addEventListener("click", function(){ fxMx.mode = fxMx.mode; setTimeout(fxRenderAll, 90); setTimeout(function(){
    /* Re-render F02 in whichever host is active: the open lesson's
       card, or the standalone Guided Practice view's card. */
    var mb = $("modalBack");
    if (mb && mb.classList.contains("open") && typeof currentLesson !== "undefined" && currentLesson >= 0) fxOnLesson(currentLesson);
    else fx02RenderStandalone();
  }, 120); });
});
window.addEventListener("storage", function(){ fxRenderAll(); });
window.addEventListener("focus", function(){ fxRenderAll(); });
document.addEventListener("visibilitychange", function(){ if (!document.hidden) fxRenderAll(); });
fxMissLoad();
fxRenderAll();
})();
