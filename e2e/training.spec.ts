import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

/** Walks through the check-in questions of a new training. */
async function checkIn(
  page: Page,
  a: { rating: string; late?: boolean; training: string; energy: string; duration: string },
) {
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Question 1 of 6')).toBeVisible();
  await dialog.getByRole('button', { name: new RegExp(a.rating) }).click();
  await dialog.getByLabel('What made it go badly?').fill('Slept badly');
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByRole('button', { name: a.late ? 'Late' : 'On time' }).click();
  await dialog.getByLabel('Training', { exact: true }).fill(a.training);
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByRole('button', { name: new RegExp(a.energy) }).click();
  await dialog.getByLabel('Why was your energy low?').fill('Short night');
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByRole('button', { name: a.duration, exact: true }).click();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByRole('button', { name: 'No', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Check your answers' })).toBeVisible();
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

  // The check-in asks one question at a time; empty answers are not accepted.
  await page.getByRole('button', { name: 'Add training' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /Good/ }).click();
  await dialog.getByLabel('What made it go well?').fill('Great sparring partner');
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByRole('button', { name: 'On time' }).click();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.getByText('Type at least 2 letters.')).toBeVisible();
  await dialog.getByLabel('Training', { exact: true }).fill('MMA');
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByRole('button', { name: /High/ }).first().click();
  await dialog.getByRole('button', { name: 'Next' }).click(); // the reason is optional
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.getByText('Choose how long you trained.')).toBeVisible();
  await dialog.getByLabel('Hours').fill('1');
  await dialog.getByLabel('Minutes').fill('30');
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByRole('button', { name: 'Yes', exact: true }).click();
  await dialog.getByLabel(/Where does it hurt/).fill('Left knee');
  await dialog.getByLabel(/Why do you think/).fill('Landed wrong');
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.getByRole('heading', { name: 'Check your answers' })).toBeVisible();
  await expect(dialog.getByText('Left knee')).toBeVisible();
  await expect(dialog.getByText('Landed wrong')).toBeVisible();
  await expect(dialog.getByText('Great sparring partner')).toBeVisible();
  await dialog.getByLabel(/Anything else to add/).fill('Good sparring, slow start.');
  await shot('form');
  await dialog.getByRole('button', { name: 'Save training' }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByText('1:30 h').filter({ visible: true }).first()).toBeVisible();
  const stats = page.locator('section', { has: page.getByRole('heading', { name: 'This month' }) });
  await expect(stats.getByText('Training days').locator('..')).toContainText('1');
  await expect(stats.getByText('Hours', { exact: true }).locator('..')).toContainText('1.5');
  await shot('calendar-month');

  // Edit it from the day panel: the summary opens, one answer is changed.
  await page
    .getByRole('button', { name: /MMA.*1:30 h/ })
    .last()
    .click();
  await expect(dialog.getByRole('heading', { name: 'Check your answers' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Change: Time' }).click();
  await expect(dialog.getByLabel('Hours')).toHaveValue('1');
  await expect(dialog.getByLabel('Minutes')).toHaveValue('30');
  await dialog.getByRole('button', { name: '1:00 h', exact: true }).click();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('1:00 h').filter({ visible: true }).first()).toBeVisible();

  // A second training with a name the user types: it becomes a sport of their own.
  await page.getByRole('button', { name: 'Add training' }).first().click();
  await checkIn(page, {
    rating: 'Not great',
    late: true,
    training: 'Sambo',
    energy: 'Low',
    duration: '45 min',
  });
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
