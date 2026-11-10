import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

// Dashboard numbers, a weekly goal, and a weekly report from training data entered in the UI.
test('dashboard, goals and weekly report', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('status of 401')) errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  const shot = (name: string) =>
    page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });

  const id = randomUUID().slice(0, 8);
  const email = `e2e-${id}@test.pace.invalid`;
  const password = 'correct-horse-battery';
  await page.goto('/register');
  await page.getByLabel('First name').fill('Carlos');
  await page.getByLabel('Username').fill(`e2e_${id}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/profile$/);

  await page.getByRole('link', { name: 'Dashboard' }).first().click();
  await expect(page.getByRole('heading', { name: 'Welcome back, Carlos' })).toBeVisible();
  const kpi = (label: string) =>
    page.locator('dl > div').filter({ has: page.getByText(label, { exact: true }) });
  await expect(kpi('Sessions').or(kpi('Trainings'))).toContainText('0');

  // A training from the dashboard.
  await page.getByRole('button', { name: 'Add training' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /Good/ }).click();
  await dialog.getByRole('button', { name: 'On time' }).click();
  await dialog.getByLabel('Training', { exact: true }).fill('BJJ');
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByRole('button', { name: /High/ }).click();
  await dialog.getByRole('button', { name: '1:30 h', exact: true }).click();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByRole('button', { name: 'No', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save training' }).click();
  await expect(dialog).toBeHidden();
  await expect(kpi('Training hours')).toContainText('1.5');
  await expect(kpi('Trainings')).toContainText('1');
  await expect(kpi('Punctuality')).toContainText('100%');
  await expect(kpi('Current streak')).toContainText('Set a training-day goal');

  // A goal of one training day per week is reached right away and starts a streak.
  await page.getByRole('button', { name: 'Add goal' }).click();
  await dialog.getByLabel('Type of goal').selectOption('training_days');
  await dialog.getByLabel('Days per week').fill('1');
  await dialog.getByRole('button', { name: 'Add goal' }).click();
  await expect(dialog.getByText('Train at least 1 day per week')).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(kpi('Current streak')).toContainText('1 week');
  await expect(
    page.getByRole('progressbar', { name: 'Train at least 1 day per week' }),
  ).toHaveAttribute('aria-valuenow', '100');

  for (const period of ['Month', 'Year']) {
    await page.getByText(period, { exact: true }).click();
    await expect(kpi('Training hours')).toContainText('1.5');
  }
  await shot('dashboard');

  // Create this week's report now instead of waiting for Sunday 18:00.
  const monday = await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toLocaleDateString('en-CA');
  });
  // Two trainings in the previous week, so the report has something to compare with.
  const origin = new URL(page.url()).origin;
  const sports = await (await page.request.get('/api/v1/sports')).json();
  const mma = sports.find((x: { slug: string }) => x.slug === 'mma').id;
  for (const [offset, punctuality] of [
    [-7, 'late'],
    [-5, 'on_time'],
  ] as const) {
    const date = await page.evaluate(
      ([m, o]) => {
        const d = new Date(`${m}T12:00:00`);
        d.setDate(d.getDate() + o);
        return d.toLocaleDateString('en-CA');
      },
      [monday, offset] as const,
    );
    const res = await page.request.post('/api/v1/sessions', {
      headers: { Origin: origin },
      data: {
        date,
        sportId: mma,
        gymId: null,
        durationMinutes: 60,
        punctuality,
        rating: 2,
        energy: 3,
        injured: false,
        reflection: offset === -7 ? 'Slept badly' : null,
        shareDetails: false,
      },
    });
    expect(res.status()).toBe(201);
  }
  execFileSync('npm', ['run', 'report:generate', '-w', 'server', '--', email, monday], {
    stdio: 'ignore',
  });

  await page.reload();
  await page.getByText('Your weekly report is ready.').click();
  await expect(page.getByRole('heading', { name: 'Weekly report', level: 1 })).toBeVisible();
  await expect(page.getByText('Trainings: 1 · training days: 1 · hours: 1.5.')).toBeVisible();
  await expect(
    page.getByText('You trained 1.5 hours, 25% less than last week (2 h).'),
  ).toBeVisible();
  await expect(page.getByText('Punctuality improved from 50% to 100%.')).toBeVisible();
  await expect(page.getByRole('cell', { name: '1.5' })).toBeVisible();
  await expect(page.getByText('You reached all your goals (1).')).toBeVisible();
  await expect(page.getByText('Train at least 1 day per week')).toBeVisible();
  await shot('report');

  await page.getByRole('link', { name: 'All reports' }).click();
  await expect(page.getByRole('link', { name: /1 training day/ })).toBeVisible();
  await expect(page.getByText('New', { exact: true })).toHaveCount(0);

  await page.goto('/settings#delete');
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await page.getByRole('dialog').getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});
