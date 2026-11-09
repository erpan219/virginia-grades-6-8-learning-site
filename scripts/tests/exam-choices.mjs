import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const exams = readFileSync(new URL('../../enhancements/exams-profiles.js', import.meta.url), 'utf8');
const mixed = readFileSync(new URL('../../enhancements/research-features.js', import.meta.url), 'utf8');
const choices = readFileSync(new URL('../../enhancements/choice-order.js', import.meta.url), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
function fn(source, name, indent = '') {
  const start = source.indexOf(`${indent}function ${name}(`);
  assert.ok(start >= 0, `${name} exists in production source`);
  const end = source.indexOf(`\n${indent}}`, start);
  assert.ok(end > start, `${name} function end exists`);
  return source.slice(start, end + indent.length + 2);
}
function element(attrs = {}) {
  return { attrs, handlers: {}, textContent: '', innerHTML: '',
    getAttribute(name) { return this.attrs[name]; },
    addEventListener(name, handler) { this.handlers[name] = handler; },
    focus() {}, classList: { toggle() {}, add() {}, remove() {} } };
}
function hostFor(attribute) {
  let html = '';
  return { buttons: [],
    get innerHTML() { return html; },
    set innerHTML(value) {
      html = value;
      this.buttons = [...value.matchAll(new RegExp(`${attribute}=['"](\\d+)['"]`, 'g'))]
        .map(match => element({ [attribute]: match[1] }));
    },
    querySelectorAll(selector) { return selector === `[${attribute}]` ? this.buttons : []; } };
}
function examContext() {
  const storage = new Map(), elements = new Map();
  const context = vm.createContext({
    EXAM_KEY: 'vaSolExam.v1', PROFILE_VERSION: 1, SAMPLER_VERSION: 'test',
    EXAM_CFG: { prngVersion: 'test', scoringVersion: 'test' },
    LS: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    profileById: id => id === 'algebra1.eoc' ? { id } : null,
    examUI: {}, language: 0, langIdx() { return context.language; },
    uuid: () => 'exam-test', bankVersion: () => 'bank-test', recentExposureOf: () => [],
    markShown() {}, renderExam() {}, startTimer() {}, stopTimer() {}, renderExamReport() {},
    recordProfileLabel: () => 'Algebra I', designationOf: () => 'practice',
    recordTotal: a => a.questions.length, recordDurationSec: a => a.durationSec,
    profileMetaOf: () => ({}), nowIso: () => new Date().toISOString(),
    T: (en, zh) => context.language ? zh : en,
    F: en => en, esc: value => String(value),
    $: id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
  });
  vm.runInContext(choices, context);
  for (const name of ['isSubjectExamRecord', 'readExamStore', 'writeExamStore', 'answeredOf', 'answeredCount', 'profileMetaOf', 'startExam', 'mutateActive', 'effectiveNow', 'remainingSec', 'fmtClock', 'finalizeExam', 'renderSession']) {
    vm.runInContext(fn(exams, name, '  '), context);
  }
  const question = ['prompt', '题干', [['first', '第一'], ['second', '第二'], ['third', '第三']], 0, 'why', '解释'];
  const profile = { id: 'algebra1.eoc', title: { en: 'Algebra I', zh: '代数 I' }, subject: 'algebra1', grade: null, assessmentLevel: 'eoc', assessmentKind: 'sol-practice' };
  context.examUI.prepared = { profileId: profile.id, storeRev: 0, durationSec: 120, Q: 1, seed: 1, bank: [], sel: { lessonCounts: { 'lesson-64': 1 }, items: [{ questionId: 'L64Q0', lessonId: 'lesson-64', question: [[question[0], question[1]], question[2], question[3], [question[4], question[5]]] }] } };
  return { context, profile, elements };
}

test('new exam saves one choice seed and preserves canonical answer through rendering, reload, language change, and grading', () => {
  const { context: c, profile } = examContext();
  c.startExam(profile);
  let record = copy(c.readExamStore());
  assert.equal(typeof record.active.choiceSeed, 'string');
  assert.ok(record.active.choiceSeed.length > 0);
  // Choose a deterministic seed that visibly moves correct option 0.
  let seed = 0;
  while (c.vaChoiceOrder(3, `exam-${seed}`, 'L64Q0')[0] === 0) seed++;
  record.active.choiceSeed = `exam-${seed}`;
  c.writeExamStore(record);
  const originalQuestions = copy(record.active.questions);
  const host = hostFor('data-opt');
  c.renderSession(host, c.readExamStore().active);
  const displayed = host.buttons.map(b => +b.attrs['data-opt']);
  assert.notEqual(displayed[0], 0);
  host.buttons.find(b => b.attrs['data-opt'] === '0').handlers.click();
  record = copy(c.readExamStore());
  assert.equal(record.active.responses.L64Q0, 0);
  assert.deepEqual(record.active.questions, originalQuestions);
  c.language = 1;
  c.renderSession(host, copy(record.active));
  assert.deepEqual(host.buttons.map(b => +b.attrs['data-opt']), displayed);
  assert.match(host.innerHTML, /data-opt="0" aria-pressed="true"/);
  assert.match(host.innerHTML, /第一/);
  c.finalizeExam('submitted');
  const result = copy(c.readExamStore());
  assert.equal(result.active, null);
  assert.equal(result.history[0].correctCount, 1);
  assert.equal(result.history[0].questionResults[0].response, 0);
});

test('legacy exam without choice seed preserves original order and existing response', () => {
  const { context: c, profile } = examContext();
  c.startExam(profile);
  const record = copy(c.readExamStore());
  delete record.active.choiceSeed;
  record.active.responses.L64Q0 = 2;
  c.writeExamStore(record);
  const host = hostFor('data-opt');
  c.renderSession(host, c.readExamStore().active);
  assert.deepEqual(host.buttons.map(b => +b.attrs['data-opt']), [0, 1, 2]);
  assert.match(host.innerHTML, /data-opt="2" aria-pressed="true"/);
  assert.equal(c.readExamStore().active.choiceSeed, undefined);
  c.finalizeExam('submitted');
  assert.equal(c.readExamStore().history[0].correctCount, 0);
});

function mixedContext() {
  const elements = new Map();
  let stored = { version: 1, days: {} };
  const c = vm.createContext({
    LESSONS: [{ q: [['prompt', '题干', [['correct', '正确'], ['wrong', '错误'], ['other', '其他']], 0, 'why', '解释']] }],
    fxMixedLoad: () => copy(stored), fxMixedSave: value => { stored = copy(value); return true; },
    fxToday: () => '2026-11-09', fxDayOfMs: () => '2026-11-02',
    fxAllCards: () => [], fxMissLoad: () => ({ items: { '0_0': { firstDay: '2026-11-01', lastDay: '2026-11-01' } } }),
    doneSet: {}, FX_EXPLAIN: [], fxMx: { checked: false, selOpt: -1 },
    FX: { mixed: { check: ['Check', '检查'], solution: ['Solution', '答案'], correct: ['Correct', '正确'], incorrect: ['Incorrect', '错误'] } },
    fxEsc: String, fxT: pair => pair?.[0] || '', fxH: pair => pair?.[0] || '',
    fxMissRecord() {}, fxRenderMixed() {}, fxMxRestoreNext() {},
    $: id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
  });
  vm.runInContext(choices, c);
  for (const name of ['fxMixedBuildSession', 'fxMxSaveSession', 'fxMxRunProblem']) vm.runInContext(fn(mixed, name), c);
  return { c, elements };
}

test('daily mixed review retains one saved seed and canonical selection on redraw', () => {
  const { c, elements } = mixedContext();
  const sess = c.fxMixedBuildSession();
  assert.ok(sess.choiceSeed);
  assert.equal(c.fxMixedBuildSession().choiceSeed, sess.choiceSeed);
  const slot = sess.slots.find(s => s.kind === 'missed');
  const host = hostFor('data-fxopt');
  c.fxMxRunProblem(host, sess, slot);
  const order = host.buttons.map(b => +b.attrs['data-fxopt']);
  host.buttons.find(b => b.attrs['data-fxopt'] === '0').handlers.click();
  assert.equal(c.fxMx.selOpt, 0);
  assert.deepEqual(host.buttons.map(b => +b.attrs['data-fxopt']), order);
  elements.get('fxMxCheck').handlers.click();
  assert.equal(c.fxMixedBuildSession().slots.find(s => s.kind === 'missed').outcome, 'correct');
  assert.equal(c.fxMixedBuildSession().choiceSeed, sess.choiceSeed);
});

test('seedless daily mixed session remains seedless and retains original option order', () => {
  const { c } = mixedContext();
  const sess = c.fxMixedBuildSession();
  delete sess.choiceSeed;
  c.fxMxSaveSession(sess);
  const restored = c.fxMixedBuildSession();
  assert.equal(restored.choiceSeed, undefined);
  const host = hostFor('data-fxopt');
  c.fxMxRunProblem(host, restored, restored.slots.find(s => s.kind === 'missed'));
  assert.deepEqual(host.buttons.map(b => +b.attrs['data-fxopt']), [0, 1, 2]);
});
