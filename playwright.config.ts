import { defineConfig, devices } from '@playwright/test';

const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: ci,
  reporter: ci ? [['list'], ['github']] : 'list',
  timeout: 60_000,
  fullyParallel: false,
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/api/health',
    // Locally, reuse a running `npm run dev`; CI always starts its own.
    reuseExistingServer: !ci,
    timeout: 120_000,
  },
});
