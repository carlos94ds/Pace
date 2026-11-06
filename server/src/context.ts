import type { Logger } from 'pino';
import type { PrismaClient } from './generated/prisma/client';
import type { Mailer } from './lib/mailer';
import type { Storage } from './lib/storage';

/** Everything route handlers need, passed in explicitly so tests can swap storage and mail. */
export interface AppContext {
  prisma: PrismaClient;
  storage: Storage;
  mailer: Mailer;
  logger: Logger;
  config: {
    appUrl: string;
    /** Secure, __Host- prefixed cookies; requires HTTPS. */
    production: boolean;
  };
}
