# Content expansion — 9 November 2026

This package deepens twelve existing lessons, one in each grade/subject combination. It adds no routes, sections, lesson IDs, storage keys, images, or new learning mechanisms. It provides 12 bilingual explanatory paragraphs, 12 worked examples, 48 multiple-choice questions, 24 conceptual flashcards, and 96 choice-specific wrong-answer explanations.

## Integration

Run `node content/build.mjs` and `node content/validate.mjs` from the repository root. The builder writes three generated files and does not edit `index.html`.

1. Insert `corrections.inline.js` followed by `enrichment.inline.js` immediately before `var VIDEOS =`, in the same script as `var LESSONS`. They must run in that order before any deck, assessment, or question pools are created.
2. Insert `wrong-reasons.inline.js` immediately after the one-line `var VA_WRONG = {...};` declaration. This extends the established feedback table with exact keys `lesson:question:option`.
3. Replace the hardcoded home-page question count of 511 with 559, preferably deriving it from `LESSONS`. The existing deck scope counters already use array lengths and account for cloze cards.
4. The separately generated corrections bundle applies the reviewed field changes exported by `corrections.mjs`. It preserves all record counts, option positions, and answer indices, including answer index 2 for lesson 23/question 6. Selected distractor wording is improved in place, with matching updates to the choice-specific feedback. The validator verifies the corrected baseline before appending enrichment and confirms later reapplication cannot erase appended examples.

New questions have indices 7–10 in each target lesson. New cards have indices 3–4. The original records and IDs remain in their existing positions. The script validates every target before mutating any data and is idempotent. All additions are inline after integration, retaining the self-contained site.

## Coverage

| Grade | Math | English | Science | History/civics |
|---|---|---|---|---|
| 6 | Ratios: part/whole, units, fair price comparisons | Theme: text evidence, topic vs statement, overgeneralization | Investigation: controls, unexpected data, observation vs inference | Revolution: chronology, source perspective, declaration vs treaty |
| 7 | Two-step equations: equivalent methods, negative coefficients, contextual checking | Arguments: relevant evidence, qualified claims, reasoning, counterarguments | Heredity: model limits, genotype/phenotype, independent probabilities | Civil rights: institutions, methods, enforcement, local sources |
| 8 | Slope: signed rates, vertical lines, contextual models | Media: original context, independent evidence, statistical claims | Reactions: system boundary, gases, atom accounting | Government: branch vs level, veto override, judicial review |

The history sequence follows the owner's existing Grade 6 USI / Grade 7 USII / Grade 8 Civics decision. This is enrichment of the existing course sequence, not a claim of complete coverage of the re-sequenced 2023 standards. No new official SOL score or readiness claim is made.

## Audit findings and validation

- All 73 original lessons and 511 original MC records passed structural, option uniqueness, and answer-index checks. This is not a claim that every original factual statement has received a complete expert review.
- The original bank gives every lesson seven questions. Many sampled items check recognition or recall; new items emphasize interpreting evidence, applying ideas, and explaining misconceptions.
- The original theme example labels “a race” as a main idea; the correction distinguishes topic, main idea, and theme.
- The original two-step question describes a valid division-first solution as a poor move. The correction retains its answer position but explicitly recognizes both valid methods.
- The original heredity text over-applies a one-gene model to eye color. The correction states the model's limits and recognizes multiple genes.
- The prompt “Which table shows a function?” appears in two existing lessons with different tables; this is repeated wording, not duplicate answer records. No original item was removed.
- Existing assessment revision strings use the question count and answer positions. Saved baseline/latest totals retain their recorded denominators; future complete attempts in enriched lessons contain 11 questions. No stored baseline is recalculated by this package.
- Numerical checks independently calculate unit rates, fraction-of-whole, signed equation solutions, slope, percentage change, and simple Punnett probabilities. Data checks verify every new language pair, unique new question and card terms, every distractor explanation, all twelve grade/subject combinations, stable original IDs, and idempotent application.

After integration, the totals are **73 lessons, 559 MC questions, and 545 flashcards** including the existing extra vocabulary and cloze cards. Existing TEIs are unchanged.

Browser validation belongs to the integrating owner: check enriched lesson Learn/Check/Words views in EN and Chinese at 390px/1440px; answer correct and wrong options for new questions; flip and rate new cards; verify challenge/exam pool availability and print layouts. Test existing saved learner records without clearing or migrating them. The Node checks cannot certify those browser behaviors.

## Follow-up to the live QA report

The November 9 QA fixes extend the correction bundle from 10 to 47 reviewed field replacements across eight existing lessons. No lessons, questions, cards, or saved identities are added or reordered.

- Scientific Investigation questions 0, 2, and 3 now each supply the sunlight, controlled conditions, final-height measurement, and time interval in both languages. The report identified questions 2 and 3; question 0 had the same missing manipulated-variable context.
- Comparing Texts & Media now teaches checking original evidence and independent investigations, both in its explanation and question 2. Two copies of one unsupported claim are not two confirmations.
- Linear Functions question 4 explicitly assumes approximately normal data before applying the roughly 68% rule. Its explanation distinguishes this from a claim about arbitrary distributions. The table explanation also now specifies equal input steps before comparing output changes.
- The 19th Amendment answer describes its prohibition against denying citizens the vote on account of sex. Its explanation retains the discriminatory barriers that continued afterward. The related lesson paragraph also separates the Bill of Rights (first ten amendments) from later voting amendments.
- Nine Economics distractors now test recognizable misconceptions rather than absurd alternatives. Eleven choice-specific feedback records match the revised Economics and source-evaluation choices.

`pool-checks.mjs` checks bilingual missing-reference patterns and the explicitly audited plant setups. These are regression checks, not a claim that software can prove every question self-contained or factually correct; new contextual questions still need human review in isolation. `validate.mjs` confirms that reverting either language's plant setup is rejected, checks the corrected concepts, and confirms changed distractors have matching feedback.

The answer-position audit groups all items by lesson and all 13 courses. With at least seven questions, more than 70% of correct answers in one stored position produces a warning. It intentionally preserves the original keys (including Algebra I's 63/0/0 split) so historical learner records retain their meaning. These warnings require the integrating UI to shuffle displayed option identities and test grading, feedback, language changes, and resumed exams. They do not by themselves verify runtime shuffling.

Sources checked for this follow-up:

- [Penn State STAT 800: Explaining Variability](https://online.stat.psu.edu/stat800/Lesson02) — indexed primary teaching material states the empirical rule for normal distributions; direct page fetching timed out during this review.
- [University of Cincinnati Libraries: Trace Claims to the Original Source](https://guides.libraries.uc.edu/c.php?g=1128926&p=8352356) — checking the origin of claims and distinguishing original reporting from repetition.
- [National Archives: 19th Amendment](https://www.archives.gov/milestone-documents/19th-amendment) — amendment text and the continuation of discriminatory voting barriers after ratification.

All revised lesson wording and scenarios are authored paraphrases, not copied passages from these sources.

## Sources and authoring basis

All new scenarios and explanations are original wording. School-survey and measurement examples are illustrative, not claims about an actual school or experiment. Sources are maintained here for review, not added as a new section of the learner interface.

- [VDOE Mathematics Standards of Learning](https://www.doe.virginia.gov/teaching-learning-assessment/instruction/mathematics/standards-of-learning-for-mathematics): 2023 mathematics standards; proportional reasoning, equations, and linear relationships.
- [VDOE 2024 English Standards of Learning](https://www.doe.virginia.gov/teaching-learning-assessment/k-12-standards-instruction/english-reading-literacy/standards-of-learning): literary/informational reading, writing arguments, and examining media messages. The search-indexed official page and official summary were available; direct page opening returned 403 during this review.
- [VDOE science standards](https://www.doe.virginia.gov/teaching-learning-assessment/k-12-standards-instruction/science/standards-of-learning): the official indexed page states the 2018 K–Physics content and practices remain unchanged with the high-school expansion. Inquiry, heredity, and matter are used as topic-level authoring references; direct page opening returned 403.
- [VDOE history/social science standards](https://www.doe.virginia.gov/teaching-learning-assessment/k-12-standards-instruction/history-and-social-science/standards-of-learning): confirms the current course re-sequence, which this owner-directed enrichment does not adopt.
- [National Archives: Treaty of Paris](https://www.archives.gov/milestone-documents/treaty-of-paris): 1783 peace and recognition, distinguished from the 1776 declaration.
- [National Archives: Declaration of Independence](https://www.archives.gov/milestone-documents/declaration-of-independence): purpose and chronology of the declaration.
- [National Archives: Civil Rights Act](https://www.archives.gov/milestone-documents/civil-rights-act) and [Voting Rights Act](https://www.archives.gov/milestone-documents/voting-rights-act): distinct legislation and historical purposes. The additions describe their historical adoption, not the present legal status of each provision.
- [National Archives: Constitution transcript, Article I, Section 7](https://www.archives.gov/founding-docs/constitution-transcript): veto/override procedure.
- [NIH/NLM MedlinePlus Genetics: eye color](https://medlineplus.gov/genetics/understanding/traits/eyecolor/): multiple genes make the simple brown-dominant/blue-recessive model inadequate for human eye color.
