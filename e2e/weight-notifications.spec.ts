import { randomUUID } from 'node:crypto';
import {
  expect,
  test,
  type Browser,
  type BrowserContextOptions,
  type Page,
} from '@playwright/test';

const password = 'correct-horse-battery';
// A 1×1 PNG, enough for the server to accept and re-encode.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

async function newUser(
  browser: Browser,
  options: BrowserContextOptions,
  firstName: string,
  errors: string[],
) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (
      msg.type() === 'error' &&
      !msg.text().includes('status of 401') &&
      !msg.text().includes('status of 400')
    )
      errors.push(`${firstName}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`${firstName}: ${err.message}`));
  const id = randomUUID().slice(0, 8);
  await page.goto('/register');
  await page.getByLabel('First name').fill(firstName);
  await page.getByLabel('Username').fill(`e2e_${firstName.toLowerCase()}_${id}`);
  await page.getByLabel('Email').fill(`e2e-${id}@test.pace.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/profile$/);
  return { page, username: `e2e_${firstName.toLowerCase()}_${id}`, close: () => context.close() };
}

/** Works in any interface language: finds the controls by their place, not their text. */
async function deleteAccount(page: Page) {
  await page.goto('/settings#delete');
  await page.locator('#delete').getByRole('button').click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[type=password]').fill(password);
  await dialog.locator('button[type=submit]').click();
  await expect(page).toHaveURL(/\/login$/);
}

test('weight with photo evidence, and notifications', async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  const device = testInfo.project.use as BrowserContextOptions;
  const ana = await newUser(browser, device, 'Ana', errors);
  const ben = await newUser(browser, device, 'Ben', errors);

  // A measurement can't be saved without a photo.
  await ana.page
    .getByRole('link', { name: /Weight/ })
    .first()
    .click();
  await expect(ana.page.getByRole('heading', { name: 'Weight', level: 1 })).toBeVisible();
  await expect(ana.page.getByText('Only you can see your weight and photos.')).toBeVisible();
  await ana.page.getByRole('button', { name: 'Add measurement' }).click();
  const dialog = ana.page.getByRole('dialog');
  await dialog.getByLabel('Weight (kg)').fill('80.4');
  await dialog.getByRole('button', { name: 'Save measurement' }).click();
  await expect(dialog.getByText('Add a photo of your scale showing this weight.')).toBeVisible();

  await dialog
    .locator('input[type=file]')
    .setInputFiles({ name: 'scale.png', mimeType: 'image/png', buffer: PNG });
  await expect(dialog.getByRole('img', { name: 'Selected photo' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Save measurement' }).click();
  await expect(dialog).toBeHidden();
  await expect(ana.page.getByText('80.4 kg').first()).toBeVisible();

  await ana.page.getByRole('button', { name: 'Photo' }).click();
  const img = ana.page.getByRole('dialog').getByRole('img', { name: 'Scale showing 80.4 kg' });
  await expect(img).toBeVisible();
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await ana.page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

  await ana.page.getByRole('button', { name: /Delete measurement/ }).click();
  await ana.page.getByRole('button', { name: 'Delete with photo' }).click();
  await expect(ana.page.getByText(/No measurements yet/)).toBeVisible();

  // Ben sends a request; Ana gets a notification with an unread badge.
  await ben.page.goto(`/u/${ana.username}`);
  await ben.page.getByRole('button', { name: 'Add friend' }).click();
  await ana.page.reload();
  const bell = ana.page.getByRole('link', { name: /Notifications/ }).first();
  await expect(bell).toContainText('1');
  await bell.click();
  await expect(ana.page.getByText('Ben sent you a friend request.')).toBeVisible();
  await testInfo.attach('notifications', {
    body: await ana.page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  await ana.page.getByText('Ben sent you a friend request.').click();
  await expect(ana.page).toHaveURL(/\/friends\?tab=requests$/);
  await expect(ana.page.getByRole('link', { name: /Notifications/ }).first()).not.toContainText(
    '1',
  );

  await deleteAccount(ana.page);
  await deleteAccount(ben.page);
  await ana.close();
  await ben.close();
  expect(errors).toEqual([]);
});

// Every main page in dark mode with large text: nothing may stick out sideways.
test('dark mode and large text on every page', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  const id = randomUUID().slice(0, 8);
  await page.goto('/register');
  await page.getByLabel('First name').fill('Carlos');
  await page.getByLabel('Username').fill(`e2e_${id}`);
  await page.getByLabel('Email').fill(`e2e-${id}@test.pace.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/profile$/);

  await page.goto('/settings');
  await page.locator('#appearance').getByText('Dark', { exact: true }).click();
  await page.locator('#appearance').getByText('Large', { exact: true }).click();
  await page.locator('#language select').selectOption('de');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large');

  for (const path of [
    '/',
    '/calendar',
    '/calendar?view=week',
    '/history',
    '/reports',
    '/friends',
    '/friends?tab=find',
    '/weight',
    '/notifications',
    '/profile',
    '/settings',
  ]) {
    await page.goto(path);
    await expect(page.locator('main h1').first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `${path} is wider than the screen`).toBeLessThanOrEqual(0);
    await page.screenshot({
      path: testInfo.outputPath(`${path.replace(/[/?=]/g, '_') || 'home'}.png`),
      fullPage: true,
    });
  }
  await deleteAccount(page);
  expect(errors).toEqual([]);
});
