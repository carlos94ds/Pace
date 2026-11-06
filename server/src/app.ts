import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import { errorHandler, notFound } from './middleware/errors';
import { healthRouter } from './modules/health/health.routes';

export interface AppDeps {
  logger: Logger;
  checkDatabase: () => Promise<boolean>;
  version: string;
  /** Built React app to serve; skipped when the folder doesn't exist (e.g. in development). */
  clientDist?: string;
}

const defaultClientDist = fileURLToPath(new URL('../../client/dist', import.meta.url));

export function createApp({
  logger,
  checkDatabase,
  version,
  clientDist = defaultClientDist,
}: AppDeps): Express {
  const app = express();

  // Railway terminates TLS in front of the app; needed for correct client IPs and secure cookies.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      // Log only what's needed to trace a request; headers can carry cookies and tokens.
      serializers: {
        req: (req: { id: unknown; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/health', healthRouter(checkDatabase, version));
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-8' }));
  app.use('/api', notFound);

  if (existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false, maxAge: '1y', immutable: true }));
    // Every other GET is a client-side route of the React app.
    app.get('/{*path}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile('index.html', { root: clientDist });
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
