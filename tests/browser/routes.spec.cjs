const { test, expect, startLearner, route, language, noOverflow, visibleImagesLoad } = require('./helpers.cjs');

const routes = [
  'home', 'lessons', 'quizzes', 'flashcards', 'more', 'guided-practice',
  'sol-practice', 'daily-review', 'session-builder', 'labs', 'glossary',
  'timeline', 'mastery-map', 'scope', 'parent-briefing', 'print-studio',
  'writing-studio', 'source-detective', 'bilingual-bridge',
];

for (const code of ['en', 'zh']) {
  test(`all 19 routes render in ${code}`, async ({ page }) => {
    await startLearner(page);
    await language(page, code);
    for (const name of routes) {
      await test.step(name, async () => {
        await route(page, name);
        const view = page.locator(`#view-${name}`);
        await expect.poll(async () => (await view.innerText()).trim().length).toBeGreaterThan(60);
        await noOverflow(page);
        await visibleImagesLoad(page, view);
      });
    }
  });
}

test('narrow 320px navigation and menu fit', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'narrow-phone regression');
  await page.setViewportSize({ width: 320, height: 720 });
  await startLearner(page);
  for (const name of ['home', 'lessons', 'quizzes', 'more']) {
    await route(page, name);
    await noOverflow(page);
    const links = page.locator('#vaMainNav a');
    await expect(links).toHaveCount(5);
    for (const link of await links.all()) {
      const r = await link.boundingBox();
      expect(r.x).toBeGreaterThanOrEqual(-1);
      expect(r.x + r.width).toBeLessThanOrEqual(321);
    }
  }
  await page.locator('#navToggle').click();
  await expect(page.locator('#toolbarPanel')).toBeVisible();
  await noOverflow(page);
});
