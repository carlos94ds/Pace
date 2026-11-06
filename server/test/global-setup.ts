import { execSync } from 'node:child_process';
import { testDatabaseUrl } from './database-url';

/** Brings the test database up to the latest migration and seeds it before any test runs. */
export default function setup() {
  const url = testDatabaseUrl();
  if (!url)
    throw new Error('No test database: set TEST_DATABASE_URL or DATABASE_URL in server/.env');
  // Vitest's `env` option doesn't reach global setup, so the URL is passed explicitly.
  const env = { ...process.env, DATABASE_URL: url };
  execSync('npx prisma migrate deploy', { stdio: 'pipe', env });
  execSync('npx prisma db seed', { stdio: 'pipe', env });
}
