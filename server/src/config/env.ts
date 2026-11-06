import 'dotenv/config';
import { z } from 'zod';

const optional = z
  .string()
  .optional()
  .transform((v) => (v === '' ? undefined : v));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url({ protocol: /^mysql$/ }),
  /** Public address of the app, used in links inside emails. */
  APP_URL: z.url(),

  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.stringbool().default(false),
  /** Keeps development files apart from production files in the same bucket. */
  STORAGE_PREFIX: z.string().default(''),

  MAIL_FROM: z.string().default('PACE <no-reply@localhost>'),
  SMTP_HOST: optional,
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: optional,
  SMTP_PASSWORD: optional,
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    // Only variable names are printed, never their values.
    const problems = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`);
  }
  return result.data;
}

export const env = parseEnv(process.env);
