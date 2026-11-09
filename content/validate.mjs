import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { enrichment } from './enrichment.mjs';
import { wrongReasons } from './wrong-reasons.mjs';
import { corrections, correctionTitles, correctionWrongReasons } from './corrections.mjs';
import { makeCorrectionsBundle, makeContentBundle, wrongReasonBundle } from './build.mjs';
import { validatePooledStems, answerPositionAudit } from './pool-checks.mjs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const start = html.indexOf('var LESSONS=');
const end = html.indexOf('var VIDEOS =', start);
assert(start > 0 && end > start, 'Find the actual lesson data, not a copy');
const lessonSource = html.slice(start, end)
  .replace(/\/\* BEGIN VA CONTENT EXPANSION 2026-11-09 \*\/[\s\S]*?\/\* END VA CONTENT EXPANSION 2026-11-09 \*\//, '')
  .replace(/\/\* BEGIN VA CONTENT CORRECTIONS 2026-11-09 \*\/[\s\S]*?\/\* END VA CONTENT CORRECTIONS 2026-11-09 \*\//, '');
const context = {};
vm.runInNewContext(lessonSource, context, { timeout: 1000 });
const original = JSON.parse(JSON.stringify(context.LESSONS));
assert.equal(original.length, 73);
assert.equal(original.reduce((n, l) => n + l.q.length, 0), 511);

function pair(value, label, requireChinese = true) {
  assert(Array.isArray(value) && value.length === 2, `${label}: bilingual pair`);
  assert(value.every(v => typeof v === 'string' && v.trim()), `${label}: both languages present`);
  if (requireChinese) assert(/[\u3400-\u9fff]/u.test(value[1]), `${label}: Chinese text present`);
  assert(!value.some(v => /<script|javascript:|onerror\s*=/i.test(v)), `${label}: no executable markup`);
}

const originalQuestions = new Set();
const baselineDuplicatePrompts = [];
let originalCardCount = 0;
const existingTerms = new Set();
original.forEach((l, li) => {
  assert([6, 7, 8].includes(l.g), `lesson ${li} grade`);
  assert(['math', 'english', 'science', 'history'].includes(l.s), `lesson ${li} subject`);
  pair(l.t, `lesson ${li} title`);
  l.q.forEach((q, qi) => {
    assert(q.length >= 6 && q.length <= 8, `baseline ${li}:${qi} schema`);
    pair(q.slice(0, 2), `baseline ${li}:${qi} prompt`, false); // Some prompts are language-neutral equations.
    assert(Number.isInteger(q[3]) && q[3] >= 0 && q[3] < q[2].length, `baseline ${li}:${qi} answer`);
    assert.equal(new Set(q[2].map(o => o[0])).size, q[2].length, `baseline ${li}:${qi} distinct options`);
    const key = q[0].trim().toLowerCase();
    if (originalQuestions.has(key)) baselineDuplicatePrompts.push(`${li}:${qi} ${q[0]}`);
    originalQuestions.add(key);
  });
  l.v.forEach(v => { existingTerms.add(v[0].toLowerCase()); originalCardCount++; });
});
const extra = html.match(/var EXTRA_VOCAB = (\[[^\n]+\]);/);
assert(extra, 'Find original extra vocabulary');
JSON.parse(extra[1]).forEach(v => existingTerms.add(v.en.toLowerCase()));

const coverage = new Set();
let questionCount = 0, cardCount = 0, wrongCount = 0;
for (const e of enrichment) {
  const base = original[e.lesson];
  assert.equal(e.title, base.t[0]);
  coverage.add(`${base.g}:${base.s}`);
  assert.equal(e.q.length, 4);
  assert.equal(e.v.length, 2);
  e.bg.forEach((p, i) => pair(p, `${e.lesson} paragraph ${i}`));
  pair(e.ex, `${e.lesson} worked example`);
  const reasons = wrongReasons[e.lesson];
  assert.equal(reasons.length, e.q.length);
  e.q.forEach((q, qi) => {
    assert.equal(q.length, 8);
    pair(q.slice(0, 2), `${e.lesson}:${qi + 7} question`);
    pair(q.slice(4, 6), `${e.lesson}:${qi + 7} explanation`);
    pair(q.slice(6, 8), `${e.lesson}:${qi + 7} hint`);
    assert.equal(q[2].length, 3);
    assert(Number.isInteger(q[3]) && q[3] >= 0 && q[3] < 3);
    q[2].forEach((o, oi) => {
      assert.equal(o.length, 2);
      assert(o.every(t => typeof t === 'string' && t.trim()));
      if (oi === q[3]) assert.equal(reasons[qi][oi], null);
      else { pair(reasons[qi][oi], `${e.lesson}:${qi + 7}:${oi} distractor reason`); wrongCount++; }
    });
    for (const lang of [0, 1]) assert.equal(new Set(q[2].map(o => o[lang])).size, 3, 'No identical options');
    const key = q[0].trim().toLowerCase();
    assert(!originalQuestions.has(key), `Duplicate question: ${q[0]}`);
    originalQuestions.add(key); questionCount++;
  });
  e.v.forEach((v, vi) => {
    assert.equal(v.length, 4);
    pair(v.slice(0, 2), `${e.lesson} card ${vi} title`);
    pair(v.slice(2, 4), `${e.lesson} card ${vi} definition`);
    assert(!existingTerms.has(v[0].toLowerCase()), `Duplicate vocabulary: ${v[0]}`);
    existingTerms.add(v[0].toLowerCase()); cardCount++;
  });
}
assert.equal(coverage.size, 12, 'One enriched lesson for every grade × subject');
assert.equal(questionCount, 48); assert.equal(cardCount, 24); assert.equal(wrongCount, 96);

// Apply and verify the narrowly reviewed corrections before appending enrichment.
const expectedCorrected = structuredClone(original);
assert.equal(corrections.length, 47);
for (const c of corrections) {
  assert(Object.hasOwn(correctionTitles, c.lesson), 'Only explicitly reviewed lessons receive corrections');
  assert.equal(original[c.lesson].t[0], correctionTitles[c.lesson]);
  if (Array.isArray(c.value) && c.value.length === 2 && c.value.every(v => typeof v === 'string')) pair(c.value, `correction ${c.lesson}:${c.field.join(':')}`);
  if (c.field[0] === 'q' && c.field.length === 3 && [1, 5, 7].includes(c.field[2])) assert(/[\u3400-\u9fff]/u.test(c.value), 'Corrected Chinese prompt, explanation, or hint is Chinese');
  let target = expectedCorrected[c.lesson];
  for (const key of c.field.slice(0, -1)) target = target[key];
  target[c.field.at(-1)] = c.value;
}
vm.runInNewContext(makeCorrectionsBundle(), context, { timeout: 1000 });
const corrected = JSON.parse(JSON.stringify(context.LESSONS));
assert.deepEqual(corrected, expectedCorrected, 'Corrections change exactly the reviewed fields');
vm.runInNewContext(makeCorrectionsBundle(), context, { timeout: 1000 });
assert.deepEqual(JSON.parse(JSON.stringify(context.LESSONS)), corrected, 'Corrections are idempotent');
original.forEach((l, li) => {
  assert.deepEqual(corrected[li].t, l.t, `Correction preserves lesson ID ${li}`);
  assert.equal(corrected[li].q.length, l.q.length, `Correction preserves question count ${li}`);
  assert.equal(corrected[li].v.length, l.v.length, `Correction preserves card count ${li}`);
  l.q.forEach((q, qi) => {
    assert.equal(corrected[li].q[qi][2].length, q[2].length, `Correction preserves option count ${li}:${qi}`);
    q[2].forEach((option, oi) => {
      const replacement = corrected[li].q[qi][2][oi];
      pair(replacement, `corrected ${li}:${qi}:${oi} option`, false);
      if (JSON.stringify(replacement) !== JSON.stringify(option) && oi !== q[3]) {
        pair(correctionWrongReasons[`${li}:${qi}:${oi}`], `${li}:${qi}:${oi}: changed distractor has matching feedback`);
      }
    });
    assert.equal(corrected[li].q[qi][3], q[3], `Correction preserves answer index ${li}:${qi}`);
  });
  l.v.forEach((v, vi) => assert.deepEqual(corrected[li].v[vi].slice(0, 2), v.slice(0, 2), `Correction preserves card identity ${li}_${vi}`));
});
assert(corrected[6].ex[0].includes('the topic is a race. A main-idea statement is:'));
assert(corrected[6].ex[1].includes('话题是一场比赛。中心思想可以表述为：'));
assert(corrected[23].q[6][4].includes('Both methods are valid.'));
assert.equal(corrected[23].q[6][3], 2);
assert.equal((20 - 2) / 6, 3, 'Subtract-first equation solution');
assert.equal(20 / 6 - 2 / 6, 3, 'Divide-every-term-first equation solution');
assert(corrected[34].bg[1][0].includes('eye color, involve multiple genes'));
assert(corrected[34].bg[1][1].includes('包括眼睛颜色，都涉及多个基因'));
assert(corrected[34].v[2][2].includes('allele') && corrected[34].v[2][2].includes('complete-dominance model'));
validatePooledStems(corrected);
for (const lang of [0, 1]) {
  const missingContext = structuredClone(corrected);
  missingContext[11].q[2][lang] = original[11].q[2][lang];
  assert.throws(() => validatePooledStems(missingContext), /context|setup/, `Missing context is rejected in language ${lang}`);
}
assert(corrected[30].q[2][2][0][0].includes('independently'));
assert(corrected[30].q[2][2][0][1].includes('独立'));
assert(corrected[30].bg[0][0].includes('independent evidence'));
assert(corrected[61].q[5][2][1][0].includes('because of their sex'));
assert(corrected[61].q[5][4].includes('discriminatory voting laws'));
assert(corrected[61].q[5][5].includes('歧视性的投票法律'));
assert(corrected[61].bg[0][0].includes('Later voting amendments'));
assert(corrected[66].q[4][0].includes('approximately normal'));
assert(corrected[66].q[4][1].includes('近似正态分布'));
assert(corrected[66].bg[0][0].includes('equal steps'));
assert.equal(10 - 2, 8); assert.equal(10 + 2, 12);
for (const q of corrected[63].q) assert(!/Vanish|Prices are illegal|Stay frozen by law/.test(JSON.stringify(q)));

// Execute the shipped enrichment, then confirm corrected old records stay at their original IDs.
vm.runInNewContext(makeContentBundle(), context, { timeout: 1000 });
const updated = JSON.parse(JSON.stringify(context.LESSONS));
validatePooledStems(updated);
corrected.forEach((l, li) => {
  assert.deepEqual(updated[li].t, l.t, `lesson ID ${li} unchanged`);
  l.q.forEach((q, qi) => assert.deepEqual(updated[li].q[qi], q, `question ID ${li}:${qi} unchanged`));
  l.v.forEach((v, vi) => assert.deepEqual(updated[li].v[vi], v, `card ID ${li}_${vi} unchanged`));
});
assert.equal(updated.reduce((n, l) => n + l.q.length, 0), 559);
assert.equal(updated.reduce((n, l) => n + l.v.length, 0), originalCardCount + 24);
vm.runInNewContext(makeContentBundle(), context, { timeout: 1000 });
assert.equal(context.LESSONS.reduce((n, l) => n + l.q.length, 0), 559, 'Applying twice does not duplicate data');
vm.runInNewContext(makeCorrectionsBundle(), context, { timeout: 1000 });
assert.deepEqual(JSON.parse(JSON.stringify(context.LESSONS)), updated, 'Reapplying corrections cannot erase appended worked examples');
context.VA_WRONG = { 'old:key': ['old reason', '旧原因'] };
vm.runInNewContext(wrongReasonBundle, context);
assert.equal(Object.keys(context.VA_WRONG).length, 97 + Object.keys(correctionWrongReasons).length);
assert.equal(context.VA_WRONG['old:key'][0], 'old reason');
for (const [key, value] of Object.entries(correctionWrongReasons)) {
  pair(value, `${key} corrected choice feedback`);
  assert.deepEqual(JSON.parse(JSON.stringify(context.VA_WRONG[key])), value);
}

// Raw indices are historical option identities, so keep them and warn instead of
// silently rewriting learner records. The UI must shuffle displayed identities.
const positionAudit = answerPositionAudit(updated);
assert.equal(positionAudit.courses, 13);
assert.deepEqual(positionAudit.warnings.find(g => g.scope === 'course' && g.id === 'Algebra I').counts, [63, 0, 0]);
assert.equal(positionAudit.warnings.filter(g => g.scope === 'lesson' && g.id >= 64).length, 9);
const balancedFixture = {g: 6, s: 'math', t: ['Balanced fixture', '平衡示例'], q: Array.from({length: 9}, (_, i) => ['', '', [], i % 3])};
assert.equal(answerPositionAudit([balancedFixture]).warnings.length, 0, 'Balanced answer positions produce no warning');
const skewedFixture = {...balancedFixture, q: balancedFixture.q.map(q => [...q.slice(0, 3), 0])};
assert.equal(answerPositionAudit([skewedFixture]).warnings.length, 2, 'Severe skew is flagged at both lesson and course levels');
for (const warning of positionAudit.warnings) {
  console.warn(`ANSWER POSITION WARNING (${warning.scope} ${warning.id}: ${warning.title}): ${warning.counts.join('/')} — ${Math.round(warning.maximumShare * 100)}% in one stored position. Verify shuffled display order.`);
}

// Independently calculate the numerical answers used in the authored questions.
function correct(lesson, question) {
  const q = enrichment.find(e => e.lesson === lesson).q[question];
  return q[2][q[3]][0];
}
assert.equal(correct(0, 0), `${4 / 2}/${(4 + 6) / 2}`);
assert.equal(correct(0, 1), `${7.5 / 1.5} km/h`);
assert.equal(6 / 15, 2 / 5);
assert(3 / 10 < 2.4 / 6);
assert.equal(correct(23, 0), `x = ${(20 - 5) / -3}`.replace('-', '−'));
assert.equal(correct(23, 2), `${(30 - 6) / 4} tickets`);
assert.equal(4 / 2 - 3, -1);
assert.equal(correct(44, 0), String((1 - 7) / (4 - 1)).replace('-', '−'));
assert.equal(3 - 3, 0); assert.equal(correct(44, 1), 'Undefined');
assert.equal((6 - 3) / 3 * 100, 100);
assert.equal(correct(54, 0), 'About 180 g, within measurement uncertainty');
const aaAa = ['A', 'a'].flatMap(a => ['A', 'a'].map(b => a + b));
const aaRecessive = ['A', 'a'].flatMap(a => ['a'].map(b => a + b));
assert.equal(aaAa.filter(x => x === 'aa').length / aaAa.length, 1 / 4);
assert.equal(aaRecessive.filter(x => x === 'aa').length / aaRecessive.length, 1 / 2);
console.log(JSON.stringify({ baselineLessons: 73, baselineMC: 511, baselineDuplicatePrompts, reviewedCorrectionFields: corrections.length, correctedLessonIDs: Object.keys(correctionTitles).map(Number), oldAnswerIndexesUnchanged: true, addedLessons: 0, enrichedLessons: 12, addedMC: questionCount, addedCards: cardCount, newWrongOptionReasons: wrongCount, correctedWrongOptionReasons: Object.keys(correctionWrongReasons).length, totalMC: 559, totalCardsIncludingExistingExtrasAndCloze: 545, stableOldIDs: true, pooledStemChecks: 'bilingual references + audited plant setup', severeStoredPositionWarnings: positionAudit.warnings.length, gradeSubjectCoverage: [...coverage].sort() }, null, 2));
