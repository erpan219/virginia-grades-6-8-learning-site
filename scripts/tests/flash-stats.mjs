import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const patch = readFileSync(new URL('../../enhancements/flash-stats.js', import.meta.url), 'utf8');
function section(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  assert(a >= 0 && b > a, `Actual site source found: ${start}`);
  return html.slice(a, b);
}

// Exercise the site's real catalog, scope selection, SRS rules, and report
// selector. DOM painting is stubbed; these are data regression tests.
function setup({ readyState = 'complete', install = true } = {}) {
  const listeners = [];
  const context = vm.createContext({
    flashScope: 'all', flashMode: 'all', lastLessonIdx: -1,
    gradeF: 'all', subjF: 'all', srsState: {}, doneSet: {},
    document: { readyState },
    window: { addEventListener: (event, callback, options) => listeners.push({ event, callback, options }) },
    renderCalls: 0,
  });
  vm.runInContext('function renderSrsMeta() { renderCalls++; }', context);
  vm.runInContext(section('var LESSONS=', 'var VIDEOS ='), context);
  vm.runInContext(html.match(/var EXTRA_VOCAB = (\[[^\n]+\]);/)[0], context);
  vm.runInContext(html.match(/var VA_CLOZE = \[[\s\S]*?\n\];/)[0], context);
  for (const [start, end] of [
    ['function extraFilterOk(', 'function extraCountFor('],
    ['function deckLessonIdxs(', 'function buildDeck('],
    ['function srsPad(', 'function srsDefault('],
    ['function srsLevelOf(', 'function srsLoad('],
    ['function srsScopeItems(', 'function srsMasteryHtml('],
    ['function repArgmax(', 'function repBuildSteps('],
  ]) vm.runInContext(section(start, end), context);
  if (install) vm.runInContext(patch, context);
  return { context, listeners };
}

function plain(value) { return JSON.parse(JSON.stringify(value)); }
function reviewed(context, days, { mastered = false } = {}) {
  return { reviews: 5, reps: 5, streak: mastered ? 5 : 2, due: context.srsDateStr(days) };
}
function allCatalog(context) {
  return [
    ...context.LESSONS.flatMap((lesson, lid) => lesson.v.map((_, vid) => ({ id: `${lid}_${vid}`, g: lesson.g, s: lesson.s, lid }))),
    ...context.EXTRA_VOCAB.map((card, vid) => ({ id: `x${vid}`, g: card.g, s: card.s, lid: -1 })),
    ...context.VA_CLOZE.map(card => ({ id: card.cardId, g: context.LESSONS[card.lid].g, s: context.LESSONS[card.lid].s, lid: card.lid })),
  ];
}

test('all-card due and mastery totals include cloze without changing SRS state', () => {
  const { context: c } = setup({ install: false });
  const before = c.srsCounts().total;
  vm.runInContext(patch, c);
  const expected = allCatalog(c).length;
  assert.equal(expected - before, 24);
  assert.deepEqual(plain(c.srsCounts()), { new: expected, learning: 0, reviewing: 0, mastered: 0, total: expected, due: expected });
  const id = c.VA_CLOZE[0].cardId;
  c.srsState[id] = reviewed(c, 10, { mastered: true });
  const stateBefore = plain(c.srsState);
  c.flashMode = 'due';
  const counts = c.srsCounts();
  assert.equal(counts.total, expected);
  assert.equal(counts.due, expected - 1);
  assert.equal(counts.mastered, 1);
  assert.equal(counts.new, expected - 1);
  assert.deepEqual(plain(c.srsState), stateBefore);
});

test('lesson and grade/subject scopes include only their cloze and keep future cards in totals', () => {
  const { context: c } = setup();
  const selected = c.VA_CLOZE[0];
  c.flashScope = 'lesson'; c.lastLessonIdx = selected.lid; c.flashMode = 'due';
  c.srsState[selected.cardId] = reviewed(c, 2, { mastered: true });
  const expectedLesson = allCatalog(c).filter(card => card.lid === selected.lid).length;
  assert.equal(c.srsCounts().total, expectedLesson);
  assert.equal(c.srsCounts().due, expectedLesson - 1);
  assert.equal(c.srsCounts().mastered, 1);
  assert(!c.srsScopeItems().some(card => card.id.startsWith('x')));

  for (const grade of [6, 7, 8]) for (const subject of ['math', 'english', 'science', 'history']) {
    c.flashScope = 'filter'; c.gradeF = String(grade); c.subjF = subject;
    const expected = allCatalog(c).filter(card => card.g === grade && card.s === subject).map(card => card.id).sort();
    assert.deepEqual(Array.from(c.srsScopeItems(), card => card.id).sort(), expected);
    assert.equal(c.srsCounts().total, expected.length);
  }
  c.gradeF = '99';
  assert.equal(c.srsCounts().total, 0);
  assert.equal(c.srsCounts().due, 0);
});

test('report includes reviewed due extras and cloze across subjects, excluding new/future/orphan records', () => {
  const { context: c } = setup();
  const mathCloze = c.VA_CLOZE.find(card => c.LESSONS[card.lid].s === 'math');
  const englishCloze = c.VA_CLOZE.find(card => c.LESSONS[card.lid].s === 'english');
  const scienceExtra = c.EXTRA_VOCAB.findIndex(card => card.s === 'science');
  const historyExtra = c.EXTRA_VOCAB.findIndex(card => card.s === 'history');
  const lesson = c.LESSONS.findIndex(card => card.s === 'history');
  c.srsState[mathCloze.cardId] = reviewed(c, -1);
  c.srsState[englishCloze.cardId] = reviewed(c, 10, { mastered: true });
  c.srsState['x' + scienceExtra] = reviewed(c, 0);
  c.srsState['x' + historyExtra] = { reviews: 0, due: c.srsDateStr(-1) };
  c.srsState[`${lesson}_0`] = reviewed(c, -2);
  c.srsState['not-a-current-card'] = reviewed(c, -1);
  c.flashScope = 'filter'; c.gradeF = '6'; c.subjF = 'english'; c.flashMode = 'due';
  const report = c.repData();
  assert.deepEqual(plain(report.dueBySubj), { math: 1, english: 0, science: 1, history: 1 });
  assert.equal(report.dueReviewedTotal, 3);
  assert.equal(report.topDueSubj, 'math'); // Preserve existing deterministic tie rule.
  assert.equal(report.flashDueReviewed, 0);
  assert.equal(report.flash.mastered, 1);
  assert.equal(report.total, c.LESSONS.length);
  assert.equal(report.doneTotal, 0);
});

test('active-scope report includes reviewed due cloze in both flash counters', () => {
  const { context: c } = setup();
  const card = c.VA_CLOZE[0];
  c.flashScope = 'lesson'; c.lastLessonIdx = card.lid;
  c.srsState[card.cardId] = reviewed(c, -1);
  const report = c.repData();
  assert.equal(report.flashDueReviewed, 1);
  assert.equal(report.flash.reviewing, 1);
  assert.equal(report.flash.total, allCatalog(c).filter(item => item.lid === card.lid).length);
});

test('repeated installation and overlapping card catalogs never double-count', () => {
  const { context: c } = setup({ install: false });
  const expected = allCatalog(c).length;
  vm.runInContext(`var testOriginalItems = srsScopeItems;
    srsScopeItems = function () {
      return testOriginalItems().concat([{id: VA_CLOZE[0].cardId}, {id: VA_CLOZE[0].cardId}]);
    };`, c);
  c.VA_CLOZE.push(c.VA_CLOZE[0]);
  c.VA_CLOZE.push({ cardId: '0_0', lid: 0 });
  c.srsState[c.VA_CLOZE[0].cardId] = reviewed(c, -1);
  c.srsState['0_0'] = reviewed(c, -1);
  vm.runInContext(patch, c);
  vm.runInContext(patch, c);
  assert.equal(c.srsCounts().total, expected);
  assert.equal(c.repData().dueReviewedTotal, 2);
  assert.equal(c.renderCalls, 1);
});

test('initial statistics refresh runs once after load, or immediately if already loaded', () => {
  const { context: c, listeners } = setup({ readyState: 'loading' });
  vm.runInContext(patch, c);
  assert.equal(c.renderCalls, 0);
  assert.equal(listeners.length, 1);
  assert.equal(listeners[0].event, 'load');
  assert.equal(listeners[0].options.once, true);
  listeners[0].callback();
  assert.equal(c.renderCalls, 1);
  const complete = setup();
  assert.equal(complete.context.renderCalls, 1);
  assert.equal(complete.listeners.length, 0);
});
