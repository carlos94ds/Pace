import { randomUUID } from 'node:crypto';
import {
  expect,
  test,
  type Browser,
  type BrowserContextOptions,
  type Page,
} from '@playwright/test';

const password = 'correct-horse-battery';

async function newUser(
  browser: Browser,
  options: BrowserContextOptions,
  firstName: string,
  errors: string[],
) {
  // Same device settings as the project (desktop or phone).
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('status of 401'))
      errors.push(`${firstName}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`${firstName}: ${err.message}`));
  const id = randomUUID().slice(0, 8);
  const username = `e2e_${firstName.toLowerCase()}_${id}`;
  await page.goto('/register');
  await page.getByLabel('First name').fill(firstName);
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Email').fill(`e2e-${id}@test.pace.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/profile$/);
  return { page, username, close: () => context.close() };
}

async function deleteAccount(page: Page) {
  await page.goto('/settings#delete');
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await page.getByRole('dialog').getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

// Two people become friends, one trains, the other sees it (without private details) and reacts.
test('friends, feed and reactions', async ({ browser }, testInfo) => {
  // Two accounts and a dozen screens: longer than the default 60 seconds.
  test.setTimeout(180_000);
  const errors: string[] = [];
  const device = testInfo.project.use as BrowserContextOptions;
  const ana = await newUser(browser, device, 'Ana', errors);
  const ben = await newUser(browser, device, 'Ben', errors);

  // Ana finds Ben and sends a request.
  await ana.page.goto('/friends?tab=find');
  await ana.page.getByLabel('Search').fill(`@${ben.username}`);
  const row = ana.page.getByRole('listitem').filter({ hasText: ben.username });
  await row.getByRole('button', { name: 'Add friend' }).click();
  await expect(row.getByRole('button', { name: 'Cancel request' })).toBeVisible();

  // Ben accepts.
  await ben.page.goto('/friends');
  await expect(ben.page.getByRole('tab', { name: /Requests\s*1/ })).toBeVisible();
  await ben.page.getByRole('tab', { name: /Requests/ }).click();
  await ben.page.getByRole('button', { name: 'Accept' }).click();
  await expect(ben.page.getByText('No open requests')).toBeVisible();

  // Ana logs two trainings: one with shared details, one private.
  for (const [minutes, reflection, share] of [
    ['45', 'Shared: great rounds', true],
    ['30', 'Private: argued with my coach', false],
  ] as const) {
    await ana.page.goto('/calendar');
    await ana.page.getByRole('button', { name: 'Add training' }).first().click();
    const dialog = ana.page.getByRole('dialog');
    await dialog.getByRole('button', { name: /Okay/ }).click();
    await dialog.getByRole('button', { name: 'On time' }).click();
    await dialog.getByLabel('Training', { exact: true }).fill('Boxing');
    await dialog.getByRole('button', { name: 'Next' }).click();
    await dialog.getByRole('button', { name: /Normal/ }).click();
    await dialog.getByLabel('Minutes').fill(minutes);
    await dialog.getByRole('button', { name: 'Next' }).click();
    await dialog.getByRole('button', { name: 'No', exact: true }).click();
    await dialog.getByLabel(/Anything else to add/).fill(reflection);
    if (share) await dialog.getByRole('switch', { name: 'Share details with friends' }).click();
    await dialog.getByRole('button', { name: 'Save training' }).click();
    await expect(dialog).toBeHidden();
  }

  // Ben sees both trainings and the achievement in his feed, but not the private reflection.
  await ben.page.goto('/friends');
  await expect(ben.page.getByText('Ana').first()).toBeVisible();
  await expect(ben.page.getByText('“Shared: great rounds”')).toBeVisible();
  await expect(ben.page.getByText('First training', { exact: true })).toBeVisible();
  await expect(ben.page.getByText('argued with my coach')).toHaveCount(0);
  const firstPost = ben.page.getByRole('article').filter({ hasText: '45 min' });
  await firstPost.getByRole('button', { name: 'Respect' }).click();
  await expect(firstPost.getByRole('button', { name: /Respect\s*1/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await ben.page.screenshot({ path: testInfo.outputPath('feed.png'), fullPage: true });

  // Ana's profile as Ben sees it.
  await ben.page.getByRole('link', { name: 'Ana' }).first().click();
  await expect(ben.page.getByRole('heading', { name: 'Ana', level: 1 })).toBeVisible();
  await expect(ben.page.getByRole('heading', { name: 'Training hours per week' })).toBeVisible();
  await expect(ben.page.getByText('argued with my coach')).toHaveCount(0);
  await ben.page.screenshot({ path: testInfo.outputPath('friend-profile.png'), fullPage: true });

  // Ana makes her activity private: Ben's feed loses the trainings.
  await ana.page.goto('/settings#privacy');
  await ana.page
    .locator('#privacy div')
    .filter({ hasText: /^Training activity/ })
    .getByText('Only me', { exact: true })
    .click();
  await ben.page.goto('/friends');
  await expect(ben.page.getByText('45 min')).toHaveCount(0);

  // Ana sees her achievement on her profile.
  await ana.page.goto('/profile#achievements');
  await expect(ana.page.getByText(/Earned on/).first()).toBeVisible();

  await deleteAccount(ana.page);
  await deleteAccount(ben.page);
  await ana.close();
  await ben.close();
  expect(errors).toEqual([]);
});
