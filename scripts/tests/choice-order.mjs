import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const helper = readFileSync(new URL('../../enhancements/choice-order.js', import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function sourceFunction(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const lineEnd = html.indexOf('\n', start);
  if (html.slice(start, lineEnd).endsWith('}')) return html.slice(start, lineEnd);
  const end = html.indexOf('\n}', start);
  assert.ok(end > start, `${name} function end exists`);
  return html.slice(start, end + 2);
}
function context(values = {}) {
  const c = vm.createContext(values);
  vm.runInContext(helper, c);
  return c;
}
function functions(c, names) {
  names.forEach(name => vm.runInContext(sourceFunction(name), c));
}
function sampleLessons(count = 8) {
  return [{ t: ['Test lesson', '测试课程'], d: ['Description', '说明'], sol: 'A.TEST', g: 8, s: 'math', v: [],
    q: Array.from({ length: count }, (_, qi) => [
      `Question ${qi}`, `问题 ${qi}`,
      Array.from({ length: 3 }, (_, oi) => [`Option ${qi}:${oi}`, `选项 ${qi}:${oi}`]),
      qi % 3, `Explanation ${qi}`, `解释 ${qi}`,
    ]) }];
}

test('choice order is a deterministic permutation, uses independent returned arrays, and never changes source choices', () => {
  const c = context();
  const source = Object.freeze(['a', 'b', 'c', 'd']);
  for (let n = 0; n <= 12; n++) {
    const order = plain(c.vaChoiceOrder(n, 'fixed-seed', 'question'));
    assert.deepEqual([...order].sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i));
    assert.deepEqual(plain(c.vaChoiceOrder(n, 'fixed-seed', 'question')), order);
  }
  const order = c.vaChoiceOrder(source.length, 'fixed-seed', 'question');
  const expected = plain(order);
  order.reverse(); order.push(99);
  assert.deepEqual(plain(c.vaChoiceOrder(source.length, 'fixed-seed', 'question')), expected);
  assert.deepEqual(source, ['a', 'b', 'c', 'd']);
});

test('historical missing or invalid choice seeds preserve canonical option order', () => {
  const c = context();
  for (const seed of [undefined, null, '', 0, 42, {}, [], false]) {
    assert.deepEqual(plain(c.vaChoiceOrder(3, seed, 'lesson:question')), [0, 1, 2]);
  }
});

test('many deterministic attempt seeds remove first-position bias across every canonical choice', () => {
  const c = context(), counts = Array.from({ length: 3 }, () => [0, 0, 0]), seen = new Set();
  const attempts = 6000;
  for (let i = 0; i < attempts; i++) {
    const order = plain(c.vaChoiceOrder(3, `attempt-${i}`, `question-${i % 63}`));
    seen.add(order.join(','));
    order.forEach((canonical, display) => counts[canonical][display]++);
  }
  assert.equal(seen.size, 6, 'all six permutations occur');
  counts.flat().forEach(count => assert.ok(count > attempts * .29 && count < attempts * .38,
    `position count ${count} is broadly balanced over ${attempts} deterministic samples`));
});

test('timed MC adapter preserves IDs, labels, answer signatures, and grading after display shuffle', () => {
  const lessons = sampleLessons(), before = plain(lessons);
  const c = context({ LESSONS: lessons, qeMcMeta: () => ({ skill: 'test', code: 'test' }) });
  functions(c, ['qeMcAdapter', 'qeScoreItem', 'qeSig', 'qeChoicePair']);
  for (let qi = 0; qi < lessons[0].q.length; qi++) {
    const q = lessons[0].q[qi], item = c.qeMcAdapter(0, qi, 'timed-attempt');
    assert.deepEqual(plain(item.choices.map(choice => choice.id)).sort(), ['0', '1', '2']);
    item.choices.forEach(choice => assert.deepEqual(plain(choice.t), q[2][Number(choice.id)]));
    assert.deepEqual(plain(c.qeChoicePair(item, String(q[3]))), q[2][q[3]]);
    assert.equal(c.qeScoreItem(item, [String(q[3])]), true);
    assert.equal(c.qeScoreItem(item, [String((q[3] + 1) % 3)]), false);
    assert.equal(c.qeSig(item, [String(q[3])]), `mc:${q[3]}`);
    assert.deepEqual(plain(c.qeMcAdapter(0, qi).choices.map(choice => choice.id)), ['0', '1', '2']);
  }
  assert.deepEqual(lessons, before);
});

test('worksheet answer letters match displayed options and stay fixed across repeated and bilingual renders', () => {
  const lessons = sampleLessons(), c = context({ LESSONS: lessons, QE_ITEMS: [], SUBJ: { math: { en: 'Math' } }, esc: String, p4SheetChoiceSeed: null });
  functions(c, ['p4Letters', 'p4WorksheetData', 'p4WorksheetHtml']);
  const first = c.p4WorksheetHtml(0, false), seed = c.p4SheetChoiceSeed;
  const repeated = c.p4WorksheetHtml(0, false), withZh = c.p4WorksheetHtml(0, true);
  assert.equal(first, repeated);
  assert.equal(c.p4SheetChoiceSeed, seed);
  const optionsOf = page => [...page.matchAll(/<p class='p4-opts'>(.*?)<\/p>/g)].map(match => match[1]);
  assert.deepEqual(optionsOf(first), optionsOf(withZh));
  const keys = first.split("<div class='p4-akey'>")[1];
  optionsOf(first).forEach((line, qi) => {
    const correctLabel = lessons[0].q[qi][2][lessons[0].q[qi][3]][0];
    const renderedCorrect = line.split('<br>').find(option => option.slice(3) === correctLabel);
    assert.ok(renderedCorrect, `question ${qi} renders its correct answer`);
    assert.ok(keys.includes(`<b>${qi + 1}.</b> ${renderedCorrect[0]} — ${correctLabel}.`), `key ${qi} matches its displayed letter`);
  });
});

function captureSource(marker) {
  const pivot = html.indexOf(marker);
  assert.ok(pivot >= 0, `listener marker ${marker} exists`);
  const start = html.lastIndexOf('document.addEventListener("click",', pivot);
  const end = html.indexOf('\n}, true);', pivot);
  assert.ok(end > start, 'production listener uses capture phase');
  return html.slice(start, end + '\n}, true);'.length);
}
function installReplay(c) {
  const declaration = html.match(/^var siCheckLog = [^\n]+/m);
  assert.ok(declaration, 'production replay alias exists');
  vm.runInContext(`(function () {\n${declaration[0]}\n${captureSource('if (siRestoring) return;')}\n${sourceFunction('siRestoreCheck')}\nglobalThis.restoreLessonCheck = siRestoreCheck;\n})();`, c);
  assert.equal(c.siCheckLog, undefined, 'replay log alias stays scoped to its original IIFE');
}
function fakeQuiz(c, orders) {
  const host = { children: [] }, clicked = [];
  for (let qi = 0; qi < orders.length; qi++) {
    const box = { parentNode: host, children: [], classList: { contains: name => name === 'quiz-q' } };
    const opts = { parentNode: box, children: [], classList: { contains: name => name === 'opts' },
      querySelector(selector) { const id = selector.match(/data-oi='(\d+)'/)[1]; return this.children.find(b => b.getAttribute('data-oi') === id); } };
    box.children.push(opts); host.children.push(box);
    orders[qi].forEach(oi => {
      const button = { parentNode: opts, disabled: false,
        hasAttribute: name => name === 'data-oi', getAttribute: name => name === 'data-oi' ? String(oi) : null,
        closest: selector => selector === '.quiz-q' ? box : selector === '#mQuiz .opt' ? button : null,
        click() {
          if (button.disabled) return;
          c.listeners.forEach(listener => listener({ target: button }));
          clicked.push([qi, oi]);
          button.disabled = true;
          if (oi === c.LESSONS[0].q[qi][3]) opts.children.forEach(b => { b.disabled = true; });
        } };
      opts.children.push(button);
    });
  }
  c.$ = id => id === 'mQuiz' ? host : null;
  return { host, clicked, button: (qi, oi) => host.children[qi].children[0].children.find(b => b.getAttribute('data-oi') === String(oi)) };
}

test('first-attempt capture and partial replay use canonical IDs even when display order changes', () => {
  const c = context({ LESSONS: sampleLessons(2), currentLesson: 0,
    va5Sess: { lid: 0, first: {}, committed: false }, quizAttemptClicks: {},
    listeners: [], va5Commit() {}, document: { addEventListener(type, listener, capture) { assert.equal(capture, true); c.listeners.push(listener); } } });
  vm.runInContext(captureSource('if (!va5Sess || va5Sess.committed || typeof currentLesson'), c);
  installReplay(c);
  let quiz = fakeQuiz(c, [[2, 0, 1], [0, 2, 1]]);
  quiz.button(0, 2).click(); // First visible button is a wrong canonical option.
  quiz.button(0, 0).click(); // Correct retry must not replace the first-attempt grade.
  assert.equal(c.va5Sess.first[0], false);
  assert.deepEqual(plain(c.quizAttemptClicks), { 0: { 0: [2, 0] } });
  c.va5Sess = { lid: 0, first: {}, committed: false };
  quiz = fakeQuiz(c, [[1, 2, 0], [2, 1, 0]]);
  c.restoreLessonCheck(0);
  assert.deepEqual(quiz.clicked, [[0, 2], [0, 0]]);
  assert.equal(c.va5Sess.first[0], false);
  assert.deepEqual(plain(c.quizAttemptClicks), { 0: { 0: [2, 0] } }, 'replay does not duplicate the log');
  quiz.button(1, 1).click();
  assert.equal(c.va5Sess.first[1], true, 'correct option at display index 1 remains correct');
});

test('nested retry buttons cannot enter the lesson assessment or replay log', () => {
  const c = context({ LESSONS: sampleLessons(2), currentLesson: 0,
    va5Sess: { lid: 0, first: {}, committed: false }, quizAttemptClicks: {},
    listeners: [], va5Commit() {}, document: { addEventListener(type, listener) { c.listeners.push(listener); } } });
  vm.runInContext(captureSource('if (!va5Sess || va5Sess.committed || typeof currentLesson'), c);
  installReplay(c);
  const quiz = fakeQuiz(c, [[2, 0, 1], [0, 2, 1]]);
  const nested = { parentNode: quiz.host.children[0], classList: { contains: () => true } };
  const button = { disabled: false, hasAttribute: () => true, getAttribute: () => '0', closest: selector => selector === '.quiz-q' ? nested : button };
  c.listeners.forEach(listener => listener({ target: button }));
  assert.deepEqual(plain(c.va5Sess.first), {});
  assert.deepEqual(plain(c.quizAttemptClicks), {});
});

test('lesson reopen keeps partial-attempt order but clears completed logs for a fresh attempt', () => {
  const begin = html.indexOf('  if (!keepQuiz){\n    var priorClicks =');
  const end = html.indexOf('  var vv = VERIFIED_VIDEOS[i];', begin);
  assert.ok(begin >= 0 && end > begin, 'production quiz lifecycle block exists');
  const c = context({ LESSONS: sampleLessons(2), quizAttemptClicks: { 0: { 0: [2, 0] } }, quizChoiceSeeds: { 0: 'partial-seed' }, quizState: [true, false], renderQuiz() {} });
  vm.runInContext(`function resetQuiz(i, keepQuiz) { var L = LESSONS[i];\n${html.slice(begin, end)}\n}`, c);
  assert.equal(c.siCheckLog, undefined, 'the replay alias belongs to another IIFE, not the global scope');
  c.resetQuiz(0, false);
  assert.equal(c.quizChoiceSeeds[0], 'partial-seed');
  assert.deepEqual(plain(c.quizAttemptClicks[0]), { 0: [2, 0] });
  c.quizAttemptClicks[0][1] = [1];
  c.resetQuiz(0, false);
  assert.notEqual(c.quizChoiceSeeds[0], 'partial-seed');
  assert.equal(c.quizAttemptClicks[0], undefined);
  assert.deepEqual(plain(c.quizState), [false, false]);
  const freshSeed = c.quizChoiceSeeds[0];
  c.quizState[0] = true;
  c.resetQuiz(0, true);
  assert.equal(c.quizChoiceSeeds[0], freshSeed);
  assert.deepEqual(plain(c.quizState), [true, false]);
});

test('explicit reassessment clears old click replay and starts a new choice seed', () => {
  const c = context({ LESSONS: sampleLessons(2), currentLesson: 0, quizAttemptClicks: { 0: { 0: [2] } }, quizChoiceSeeds: { 0: 'old-seed' }, quizState: [true, false],
    window: {}, $: () => null, renderQuiz() {}, va5NewSession() {}, va5RenderAssess() {} });
  // The browser helper assigns globals through window.
  c.vaChoiceSeed = c.window.vaChoiceSeed;
  functions(c, ['va5Reassess']);
  c.va5Reassess(0);
  assert.notEqual(c.quizChoiceSeeds[0], 'old-seed');
  assert.equal(c.quizAttemptClicks[0], undefined);
  assert.deepEqual(plain(c.quizState), [false, false]);
});
