const { test, expect, startLearner, route, language, noOverflow, visibleImagesLoad, openRatioLesson } = require('./helpers.cjs');

test.beforeEach(async ({ page }) => { await startLearner(page); });

test('lesson choices preserve wrong feedback, order and first-attempt grading when reopened', async ({ page }) => {
  await openRatioLesson(page);
  const answers = await page.evaluate(() => LESSONS[0].q.map(q => q[3]));
  const questions = page.locator('#mQuiz > .quiz-q');
  const first = questions.first();
  const order = await first.locator('.opts > .opt').evaluateAll(buttons => buttons.map(b => b.dataset.oi));
  expect([...order].sort()).toEqual(['0', '1', '2']);
  const wrong = (answers[0] + 1) % 3;
  await first.locator(`.opts > [data-oi="${wrong}"]`).click();
  await expect(first.locator(`.opts > [data-oi="${wrong}"]`)).toHaveClass(/wrong/);
  await expect(first.locator('.why')).toHaveClass(/show/);
  await expect(first.locator('.va-wrong-reason').first()).not.toHaveText('');
  await page.locator('#mClose').click();
  await expect(page.locator('#modalBack')).toBeHidden();
  await openRatioLesson(page);
  await expect(first.locator(`.opts > [data-oi="${wrong}"]`)).toHaveClass(/wrong/);
  expect(await first.locator('.opts > .opt').evaluateAll(buttons => buttons.map(b => b.dataset.oi))).toEqual(order);
  for (let qi = 0; qi < answers.length; qi++) {
    const question = questions.nth(qi);
    await question.locator(`.opts > [data-oi="${answers[qi]}"]`).click();
    await expect(question.locator(`.opts > [data-oi="${answers[qi]}"]`)).toHaveClass(/right/);
  }
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('vaAssessment.v1')).lessons['0'].baseline.c)).toBe(answers.length - 1);
  const result = await page.evaluate(() => {
    const entry = JSON.parse(localStorage.getItem('vaAssessment.v1')).lessons['0'];
    return { baseline: entry.baseline, latest: entry.latest, done: JSON.parse(localStorage.getItem('vaDone.v1')) };
  });
  expect(result.baseline.t).toBe(answers.length);
  expect(result.latest.c).toBe(answers.length - 1);
  expect(result.done).toContain(0);
  await noOverflow(page);
});

test('Challenge language switch retains canonical choice, order and score', async ({ page }) => {
  await route(page, 'quizzes');
  await page.locator('#chStartBtn').click();
  const buttons = page.locator('#chBox .ch-opt');
  const order = await buttons.evaluateAll(items => items.map(b => b.dataset.oi));
  const selected = order[0];
  await buttons.first().click();
  await expect(page.locator('#chNextBtn')).toBeVisible();
  const state = await page.evaluate(() => ({ score: chScore, selection: chSel, index: chIdx }));
  await language(page, 'zh');
  expect(await buttons.evaluateAll(items => items.map(b => b.dataset.oi))).toEqual(order);
  await expect(page.locator(`#chBox .ch-opt[data-oi="${selected}"]`)).toBeDisabled();
  expect(await page.evaluate(() => ({ score: chScore, selection: chSel, index: chIdx }))).toEqual(state);
  await expect(page.locator('#chNextBtn')).toBeVisible();
  await noOverflow(page);
});

test('flashcard art is absent before reveal and rating advances the deck', async ({ page }) => {
  await route(page, 'flashcards');
  const card = page.locator('#flashCard');
  await expect(card.locator('img')).toHaveCount(0);
  const term = await page.locator('#flashFront').innerText();
  await card.click();
  await expect.poll(() => card.locator('img').count()).toBeGreaterThan(0);
  await visibleImagesLoad(page, card);
  await expect(page.locator('#srsRatings')).toBeVisible();
  await page.locator('#srsRatings [data-rate="4"]').click();
  await expect(page.locator('#flashFront')).not.toHaveText(term);
  await expect(card.locator('img')).toHaveCount(0);
});

test('exam reload preserves shuffled order, answer, flag and deadline; result art loads', async ({ page }, info) => {
  await route(page, 'sol-practice');
  await page.locator('#view-sol-practice [data-psubj="math"]').click();
  await page.locator('#view-sol-practice [data-pgrade="6"]').click();
  const intro = page.locator('.sol-illu img');
  await intro.scrollIntoViewIfNeeded();
  await expect.poll(() => intro.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.locator('#exStart').click();
  await page.locator('#exConfirmStart').click();
  const options = page.locator('.exam-opts [data-opt]');
  const order = await options.evaluateAll(items => items.map(b => b.dataset.opt));
  await options.first().click();
  await page.locator('#exFlag').click();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('vaSolExam.v1')).active);
  expect(before.choiceSeed).toBeTruthy();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#exResume')).toBeVisible();
  await page.locator('#exResume').click();
  expect(await options.evaluateAll(items => items.map(b => b.dataset.opt))).toEqual(order);
  await expect(page.locator(`.exam-opts [data-opt="${order[0]}"]`)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#exFlag')).toHaveAttribute('aria-pressed', 'true');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('vaSolExam.v1')).active);
  expect(after.choiceSeed).toBe(before.choiceSeed);
  expect(after.responses).toEqual(before.responses);
  expect(after.flaggedQuestionIds).toEqual(before.flaggedQuestionIds);
  expect(before.deadlineAtMs).toBeGreaterThan(0);
  expect(after.startedAt).toBe(before.startedAt);
  expect(after.deadlineAtMs).toBe(before.deadlineAtMs);
  expect(after.durationSec).toBe(before.durationSec);
  await page.locator('#exReview').click();
  await page.locator('#exSubmit').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Submit exam', exact: true }).click();
  const result = page.locator('.sol-illu img');
  await result.scrollIntoViewIfNeeded();
  await expect.poll(() => result.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(page.locator('#exBack')).toBeVisible();
  await noOverflow(page);
  await route(page, 'parent-briefing');
  for (const code of ['en', 'zh']) {
    await language(page, code);
    const history = page.locator('#examReportHost .exam-table-scroll');
    await expect(history).toHaveAttribute('role', 'region');
    await expect(history).toHaveAttribute('tabindex', '0');
    await expect(history.locator('table')).toBeVisible();
    await expect(history.locator('tbody tr')).toHaveCount(1);
    await noOverflow(page);
  }
  if (info.project.name === 'mobile') {
    await page.setViewportSize({ width: 320, height: 720 });
    await language(page, 'en');
    const history = page.locator('#examReportHost .exam-table-scroll');
    await expect(history.locator('table')).toBeVisible();
    await noOverflow(page);
    expect(await history.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
    await history.focus();
    await history.press('ArrowRight');
    await expect.poll(() => history.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  }
});

test('Ratio lab keyboard controls and touch targets work in both languages', async ({ page }) => {
  await route(page, 'labs');
  for (const code of ['en', 'zh']) {
    await language(page, code);
    await page.locator('#tab-ratio').click();
    const slider = page.locator('#rcRange');
    const before = Number(await slider.inputValue());
    await slider.focus();
    await slider.press('ArrowRight');
    await expect(slider).toHaveValue(String(before + 1));
    await expect(page.locator('#rcOut')).toHaveText(String(before + 1));
    for (const control of await page.locator('#panel-ratio input[type=range], #panel-ratio .step-btn').all()) {
      const r = await control.boundingBox();
      expect(r.height).toBeGreaterThanOrEqual(44);
      expect(r.width).toBeGreaterThanOrEqual(44);
    }
    await noOverflow(page);
  }
});
