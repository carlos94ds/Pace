import { config } from 'dotenv';

/** Integration tests use their own database (pace_test) next to the development one. */
export function testDatabaseUrl(): string | undefined {
  const local = config({ quiet: true, processEnv: {} }).parsed ?? {};
  return process.env.TEST_DATABASE_URL ?? local.DATABASE_URL?.replace(/\/[^/]+$/, '/pace_test');
}
