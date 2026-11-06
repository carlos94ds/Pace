import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

describe('parseEnv', () => {
  it('applies defaults', () => {
    const env = parseEnv({ DATABASE_URL: 'mysql://u:p@localhost:3306/pace' });
    expect(env).toMatchObject({ NODE_ENV: 'development', PORT: 3000, LOG_LEVEL: 'info' });
  });

  it('rejects a missing database URL without echoing values', () => {
    expect(() => parseEnv({ PORT: '3000' })).toThrow(/DATABASE_URL/);
  });

  it('rejects non-MySQL URLs', () => {
    expect(() => parseEnv({ DATABASE_URL: 'postgres://u:p@h/db' })).toThrow(/DATABASE_URL/);
  });
});
