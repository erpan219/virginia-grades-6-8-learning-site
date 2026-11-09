const { test: base, expect } = require('@playwright/test');

const test = base.extend({
  health: [async ({ page, baseURL }, use) => {
    const errors = [], resources = [], origin = new URL(baseURL).origin;
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (new URL(response.url()).origin === origin && response.status() >= 400) {
        resources.push(`${response.status()} ${response.url()}`);
      }
    });
    page.on('requestfailed', request => {
      const reason = request.failure()?.errorText || 'failed';
      if (new URL(request.url()).origin === origin && !reason.includes('ERR_ABORTED')) {
        resources.push(`${reason} ${request.url()}`);
      }
    });
    await use();
    expect.soft(errors, 'uncaught browser exceptions').toEqual([]);
    expect.soft(resources, 'broken same-origin resources').toEqual([]);
  }, { auto: true }],
});

async function startLearner(page) {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.locator('#pfGateStart').click();
  await expect(page.locator('#pfGate')).toBeHidden();
  await expect(page.locator('#view-home')).toBeVisible();
}

async function route(page, name) {
  if (new URL(page.url()).hash !== `#/${name}`) await page.goto(`#/${name}`);
  await expect(page.locator(`#view-${name}`)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#/` + name + '$'));
}

async function language(page, code) {
  const button = page.locator(code === 'zh' ? '#langZh' : '#langEn');
  if (!(await button.isVisible())) await page.locator('#navToggle').click();
  await button.click();
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('lang', code === 'zh' ? /^zh/ : /^en/);
}

async function noOverflow(page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

async function visibleImagesLoad(page, scope) {
  const images = scope.locator('img');
  for (let i = 0; i < await images.count(); i++) {
    const image = images.nth(i);
    const inViewport = await image.evaluate(img => {
      const r = img.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
    });
    if (inViewport) {
      await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0), { message: 'visible image should load' }).toBe(true);
    }
  }
}

async function openRatioLesson(page) {
  await route(page, 'lessons');
  await page.locator('#view-lessons .lcard').filter({ has: page.getByRole('heading', { name: 'Ratios & Unit Rates', exact: true }) }).locator('.open-btn').click();
  await expect(page.locator('#modalBack')).toBeVisible();
  await page.locator('#modalBack button').filter({ hasText: 'Check · 检查' }).first().click();
  await expect(page.locator('#mQuiz > .quiz-q').first()).toBeVisible();
}

module.exports = { test, expect, startLearner, route, language, noOverflow, visibleImagesLoad, openRatioLesson };
