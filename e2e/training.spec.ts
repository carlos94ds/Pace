import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

async function pickScores(page: Page, scores: [number, number, number]) {
  const dialog = page.getByRole('dialog');
  const groups = ['Motivation before', 'How it went', 'Intensity'];
  for (const [i, name] of groups.entries()) {
    await dialog.getByRole('group', { name }).getByText(String(scores[i]), { exact: true }).click();
  }
}

// Logging, editing and deleting trainings through the calendar, history and settings.
test('training calendar', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('status of 401')) errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  const shot = (name: string) =>
    page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });

  const id = randomUUID().slice(0, 8);
  const password = 'correct-horse-battery';
  await page.goto('/register');
  await page.getByLabel('First name').fill('Carlos');
  await page.getByLabel('Username').fill(`e2e_${id}`);
  await page.getByLabel('Email').fill(`e2e-${id}@test.pace.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/profile$/);

  await page.getByRole('link', { name: 'Calendar' }).first().click();
  await expect(page.getByRole('heading', { name: 'Calendar', level: 1 })).toBeVisible();

  // Validation: nothing filled in yet.
  await page.getByRole('button', { name: 'Add training' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Save training' }).click();
  await expect(dialog.getByText('Choose a sport.')).toBeVisible();
  await expect(dialog.getByText('Enter the duration in minutes.')).toBeVisible();
  await expect(dialog.getByText('Choose 1 to 5.')).toHaveCount(3);

  await dialog.getByLabel('Duration (minutes)').fill('90');
  await dialog.getByLabel('Sport').selectOption({ label: 'MMA' });
  await pickScores(page, [4, 3, 5]);
  await dialog.getByLabel('Reflection').fill('Good sparring, slow start.');
  await shot('form');
  await dialog.getByRole('button', { name: 'Save training' }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByText('1:30 h').filter({ visible: true }).first()).toBeVisible();
  const stats = page.locator('section', { has: page.getByRole('heading', { name: 'This month' }) });
  await expect(stats.getByText('Training days').locator('..')).toContainText('1');
  await expect(stats.getByText('Hours', { exact: true }).locator('..')).toContainText('1.5');
  await shot('calendar-month');

  // Edit it from the day panel.
  await page
    .getByRole('button', { name: /MMA.*1:30 h/ })
    .last()
    .click();
  await expect(dialog.getByLabel('Duration (minutes)')).toHaveValue('90');
  await dialog.getByLabel('Duration (minutes)').fill('60');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('1:00 h').filter({ visible: true }).first()).toBeVisible();

  // A second training with a sport of your own, created from the form.
  await page.getByRole('button', { name: 'Add training' }).first().click();
  await dialog.getByLabel('Sport').selectOption({ label: '+ Add your own sport…' });
  await dialog.getByLabel('Name').fill('Sambo');
  await dialog.getByRole('button', { name: 'Add sport' }).click();
  await expect(dialog.getByLabel('Sport')).toHaveValue(/[0-9a-f-]{36}/);
  await dialog.getByLabel('Duration (minutes)').fill('45');
  await dialog.getByText('Late', { exact: true }).click();
  await pickScores(page, [2, 2, 3]);
  await dialog.getByRole('button', { name: 'Save training' }).click();
  await expect(dialog).toBeHidden();
  await expect(stats.getByText('Trainings', { exact: true }).locator('..')).toContainText('2');

  await page.getByText('Week', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Sambo/ })).toBeVisible();
  await shot('calendar-week');

  // History with a filter, then delete the Sambo training.
  await page.getByRole('link', { name: 'History' }).first().click();
  await expect(page.getByRole('button', { name: /MMA|Sambo/ })).toHaveCount(2);
  await page.getByLabel('Sport').selectOption({ label: 'Sambo' });
  await expect(page).toHaveURL(/sportId=/);
  await expect(page.getByRole('button', { name: /Sambo/ })).toHaveCount(1);
  await shot('history');
  await page.getByRole('button', { name: /Sambo/ }).click();
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('No trainings match these filters')).toBeVisible();

  // The now unused sport can be removed in settings.
  await page.goto('/settings#sports');
  await page.getByRole('button', { name: 'Delete: Sambo' }).click();
  await expect(page.getByText("You haven't added any sports of your own yet.")).toBeVisible();

  await page.goto('/settings#delete');
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await page.getByRole('dialog').getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page).toHaveURL(/\/login$/);

  expect(errors).toEqual([]);
});
