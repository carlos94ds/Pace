import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

// One full account lifecycle through the real UI: register, profile, settings, delete.
test('account lifecycle', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    // A 401 on GET /me is how the app learns that nobody is logged in.
    if (msg.type() === 'error' && !msg.text().includes('status of 401')) errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  const id = randomUUID().slice(0, 8);
  const email = `e2e-${id}@test.pace.invalid`;
  const password = 'correct-horse-battery';
  const shot = (name: string) =>
    page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });

  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await shot('login');

  await page.getByRole('link', { name: 'Create an account' }).click();
  await page.getByLabel('First name').fill('Carlos');
  await page.getByLabel('Username').fill(`e2e_${id}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/profile$/);
  await page.getByLabel('Short bio').fill('MMA and BJJ.');
  await page.getByRole('button', { name: 'MMA' }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'me.png',
    mimeType: 'image/png',
    // 1×1 PNG
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    ),
  });
  await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved')).toBeVisible();
  await shot('profile');

  await page.goto('/settings');
  await page.locator('#appearance').getByText('Dark', { exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('#language select').selectOption('nl');
  await expect(page.getByRole('heading', { name: 'Instellingen', level: 1 })).toBeVisible();
  await shot('settings-dark-nl');

  // Preferences come back from the account after logging in again.
  await page.getByRole('button', { name: 'Uitloggen' }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Wachtwoord').fill(password);
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await expect(page.getByRole('heading', { name: 'Welkom, Carlos' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await shot('overview');

  await page.goto('/settings#delete');
  await page.getByRole('button', { name: 'Mijn account verwijderen' }).click();
  await page.getByRole('dialog').getByLabel('Wachtwoord').fill(password);
  await page.getByRole('button', { name: 'Definitief verwijderen' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Je account en al je gegevens zijn verwijderd.')).toBeVisible();

  expect(errors).toEqual([]);
});
