import { defineConfig } from 'vitest/config';
import { testDatabaseUrl } from './test/database-url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: testDatabaseUrl() ?? 'mysql://test:test@localhost:3306/pace_test',
      APP_URL: 'http://localhost:5173',
      S3_ENDPOINT: 'https://s3.invalid',
      S3_BUCKET: 'test',
      S3_ACCESS_KEY_ID: 'test',
      S3_SECRET_ACCESS_KEY: 'test',
    },
  },
});
