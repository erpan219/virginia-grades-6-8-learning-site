import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { enrichment } from './enrichment.mjs';
import { wrongReasons } from './wrong-reasons.mjs';
import { corrections, correctionTitles, correctionWrongReasons } from './corrections.mjs';

export function makeCorrectionsBundle() {
  const entries = corrections.map(c => {
    const title = correctionTitles[c.lesson];
    if (!title) throw new Error('Missing reviewed correction title: ' + c.lesson);
    return { lesson: c.lesson, title, field: c.field, value: c.value };
  });
  const json = JSON.stringify(entries).replaceAll('<', '\\u003c');
  return `/* BEGIN VA CONTENT CORRECTIONS 2026-11-09 */
(function () {
  if (LESSONS._vaContentCorrections === '2026-11-09') return;
  var corrections = ${json};
  // Check every field before replacing any text. Never insert or reorder records.
  corrections.forEach(function (c) {
    var target = LESSONS[c.lesson];
    if (!target || target.t[0] !== c.title) throw new Error('Content correction lesson mismatch: ' + c.lesson);
    c.field.forEach(function (key) {
      if (target == null || !Object.prototype.hasOwnProperty.call(target, key)) {
        throw new Error('Content correction field mismatch: ' + c.lesson);
      }
      target = target[key];
    });
  });
  corrections.forEach(function (c) {
    var target = LESSONS[c.lesson];
    for (var i = 0; i < c.field.length - 1; i++) target = target[c.field[i]];
    target[c.field[c.field.length - 1]] = c.value;
  });
  Object.defineProperty(LESSONS, '_vaContentCorrections', { value: '2026-11-09' });
})();
/* END VA CONTENT CORRECTIONS 2026-11-09 */
`;
}

export function makeContentBundle() {
  const wrong = {};
  for (const entry of enrichment) {
    wrongReasons[entry.lesson].forEach((options, qi) => {
      options.forEach((reason, oi) => {
        if (reason) wrong[`${entry.lesson}:${qi + 7}:${oi}`] = reason;
      });
    });
  }
  // Escape '<' so authored text can never terminate an inline script element.
  const json = JSON.stringify({ version: '2026-11-09', entries: enrichment, wrong }).replaceAll('<', '\\u003c');
  return `/* BEGIN VA CONTENT EXPANSION 2026-11-09 */
var VA_CONTENT_EXPANSION = ${json};
(function () {
  if (LESSONS._vaContentExpansion === VA_CONTENT_EXPANSION.version) return;
  // Validate every target before changing any data. Original indices are stable IDs.
  VA_CONTENT_EXPANSION.entries.forEach(function (e) {
    var lesson = LESSONS[e.lesson];
    if (!lesson || lesson.t[0] !== e.title || lesson.q.length !== 7 || lesson.v.length !== 3) {
      throw new Error('Content expansion does not match lesson ' + e.lesson);
    }
  });
  VA_CONTENT_EXPANSION.entries.forEach(function (e) {
    var lesson = LESSONS[e.lesson];
    lesson.bg = (lesson.bg || []).concat(e.bg);
    lesson.ex = [lesson.ex[0] + e.ex[0], lesson.ex[1] + e.ex[1]];
    lesson.q = lesson.q.concat(e.q);
    lesson.v = lesson.v.concat(e.v);
  });
  Object.defineProperty(LESSONS, '_vaContentExpansion', { value: VA_CONTENT_EXPANSION.version });
})();
/* END VA CONTENT EXPANSION 2026-11-09 */
`;
}

export const wrongReasonBundle = `/* BEGIN VA CONTENT WRONG REASONS 2026-11-09 */
Object.keys(VA_CONTENT_EXPANSION.wrong).forEach(function (key) {
  VA_WRONG[key] = VA_CONTENT_EXPANSION.wrong[key];
});
// Existing choices whose wording changed also need matching misconception feedback.
Object.assign(VA_WRONG, ${JSON.stringify(correctionWrongReasons).replaceAll('<', '\\u003c')});
/* END VA CONTENT WRONG REASONS 2026-11-09 */
`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await writeFile(new URL('./corrections.inline.js', import.meta.url), makeCorrectionsBundle());
  await writeFile(new URL('./enrichment.inline.js', import.meta.url), makeContentBundle());
  await writeFile(new URL('./wrong-reasons.inline.js', import.meta.url), wrongReasonBundle);
  console.log('Built content/corrections.inline.js, content/enrichment.inline.js, and content/wrong-reasons.inline.js. index.html was not changed.');
}
