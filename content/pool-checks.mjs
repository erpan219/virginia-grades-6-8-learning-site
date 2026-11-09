import assert from 'node:assert/strict';

// This catches missing references, not factual correctness. New contextual items
// still need human review in isolation, in both languages, before publication.
export function validatePooledStems(lessons) {
  const missingReference = [
    /\b(?:in the plant experiment|(?:the|this) (?:experiment|passage|table|diagram|graph) (?:above|below)|previous question|as (?:shown|described) (?:above|earlier))\b/i,
    /(?:在植物实验中|(?:上文|上题|前一题|上述实验|下图|上图|上表|下表))/u
  ];
  lessons.forEach((lesson, li) => lesson.q.forEach((q, qi) => {
    for (const lang of [0, 1]) {
      assert(typeof q[lang] === 'string' && q[lang].trim(), `${li}:${qi}: prompt language ${lang} is missing`);
      assert(!missingReference[lang].test(q[lang]), `${li}:${qi}: pooled prompt references missing context in language ${lang}`);
    }
  }));
  // Audited regressions: all three plant questions identify the deliberately
  // changed light, controlled conditions, measured height, and measurement time.
  for (const qi of [0, 2, 3]) {
    const q = lessons[11].q[qi];
    assert(/changes the hours of sunlight/.test(q[0]) && /water, soil, and pot size the same/.test(q[0]) && /measures their final heights after two weeks/.test(q[0]), `11:${qi}: English experiment setup incomplete`);
    assert(/改变.*阳光的时长/.test(q[1]) && /保持水量、土壤和花盆大小相同/.test(q[1]) && /两周后测量植物的最终高度/.test(q[1]), `11:${qi}: Chinese experiment setup incomplete`);
  }
}

function courseName(lesson) {
  if (lesson.alg) return 'Algebra I';
  const names = {
    math: `Math ${lesson.g}`, english: `English ${lesson.g}`,
    science: {6: 'Science 6', 7: 'Life Science', 8: 'Physical Science'}[lesson.g],
    history: {6: 'U.S. History to 1865', 7: 'U.S. History 1865 to Present', 8: 'Civics & Economics'}[lesson.g]
  };
  return names[lesson.s];
}

export function answerPositionAudit(lessons, {minimumQuestions = 7, severeShare = 0.7} = {}) {
  const groups = [], courses = new Map();
  const record = (group, question) => {
    group.counts[question[3]] = (group.counts[question[3]] || 0) + 1;
    group.total++;
  };
  lessons.forEach((lesson, li) => {
    const group = {scope: 'lesson', id: li, title: lesson.t[0], counts: [], total: 0};
    const course = courseName(lesson);
    if (!courses.has(course)) courses.set(course, {scope: 'course', id: course, title: course, counts: [], total: 0});
    lesson.q.forEach(q => { record(group, q); record(courses.get(course), q); });
    groups.push(group);
  });
  groups.push(...courses.values());
  const warnings = groups.filter(g => g.total >= minimumQuestions && Math.max(...g.counts.filter(Number.isFinite)) / g.total > severeShare)
    .map(g => ({...g, counts: Array.from({length: Math.max(3, g.counts.length)}, (_, i) => g.counts[i] || 0), maximumShare: Math.max(...g.counts.filter(Number.isFinite)) / g.total}));
  return {threshold: severeShare, minimumQuestions, courses: courses.size, warnings};
}
