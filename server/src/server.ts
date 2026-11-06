import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { isDatabaseUp, prisma } from './lib/prisma';

const app = createApp({
  logger,
  checkDatabase: isDatabaseUp,
  version: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
});

const server = app.listen(env.PORT, () => {
  logger.info(`PACE API listening on http://localhost:${env.PORT}`);
});

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
