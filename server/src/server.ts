import { createApp } from './app';
import { env } from './config/env';
import type { AppContext } from './context';
import { startScheduler } from './jobs/scheduler';
import { logger } from './lib/logger';
import { createMailer } from './lib/mailer';
import { isDatabaseUp, prisma } from './lib/prisma';
import { S3Storage } from './lib/storage';

const production = env.NODE_ENV === 'production';

const ctx: AppContext = {
  prisma,
  logger,
  storage: new S3Storage({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    prefix: env.STORAGE_PREFIX,
  }),
  mailer: createMailer(
    {
      from: env.MAIL_FROM,
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
      password: env.SMTP_PASSWORD,
    },
    logger,
    production,
  ),
  config: { appUrl: env.APP_URL.replace(/\/$/, ''), production },
};

const app = createApp(ctx, {
  checkDatabase: isDatabaseUp,
  version: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
  // Strict in production; locally, repeated end-to-end runs register and log in many times.
  authRateLimit: ctx.config.production ? 20 : 1000,
});

const stopScheduler = startScheduler(ctx);

const server = app.listen(env.PORT, () => {
  logger.info(`PACE API listening on http://localhost:${env.PORT}`);
});

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  stopScheduler();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
