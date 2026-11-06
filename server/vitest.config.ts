import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Unit tests never touch the database; this only satisfies env validation on import.
    env: { DATABASE_URL: 'mysql://test:test@localhost:3306/pace_test', LOG_LEVEL: 'silent' },
  },
});
