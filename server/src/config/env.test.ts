import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const base = {
  DATABASE_URL: 'mysql://u:p@localhost:3306/pace',
  APP_URL: 'http://localhost:5173',
  S3_ENDPOINT: 'https://s3.example.com',
  S3_BUCKET: 'bucket',
  S3_ACCESS_KEY_ID: 'id',
  S3_SECRET_ACCESS_KEY: 'secret',
};

describe('parseEnv', () => {
  it('applies defaults', () => {
    const env = parseEnv(base);
    expect(env).toMatchObject({ NODE_ENV: 'development', PORT: 3000, LOG_LEVEL: 'info' });
    expect(env.SMTP_HOST).toBeUndefined();
  });

  it('treats empty SMTP settings as not configured', () => {
    expect(parseEnv({ ...base, SMTP_HOST: '' }).SMTP_HOST).toBeUndefined();
  });

  it('rejects a missing database URL without echoing values', () => {
    const { DATABASE_URL: _, ...rest } = base;
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it('rejects non-MySQL URLs', () => {
    expect(() => parseEnv({ ...base, DATABASE_URL: 'postgres://u:p@h/db' })).toThrow(
      /DATABASE_URL/,
    );
  });
});
