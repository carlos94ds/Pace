import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { AppContext } from './context';
import { errorHandler, notFound } from './middleware/errors';
import { requireSameOrigin } from './middleware/same-origin';
import { loadSession } from './middleware/session';
import { authRouter } from './modules/auth/auth.routes';
import { catalogRouter } from './modules/catalog/catalog.routes';
import { healthRouter } from './modules/health/health.routes';
import { meRouter } from './modules/me/me.routes';
import { goalsRouter } from './modules/goals/goals.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { statsRouter } from './modules/stats/stats.routes';
import { trainingRouter } from './modules/training/training.routes';
import { usersRouter } from './modules/users/users.routes';

export interface AppOptions {
  checkDatabase: () => Promise<boolean>;
  version: string;
  /** Requests per 15 minutes per IP on login, registration and password reset. */
  authRateLimit?: number;
  /** API requests per minute per IP. */
  apiRateLimit?: number;
  /** Built React app to serve; skipped when the folder doesn't exist (e.g. in development). */
  clientDist?: string;
}

const defaultClientDist = fileURLToPath(new URL('../../client/dist', import.meta.url));

export function createApp(
  ctx: AppContext,
  {
    checkDatabase,
    version,
    authRateLimit = 20,
    apiRateLimit = 300,
    clientDist = defaultClientDist,
  }: AppOptions,
): Express {
  const app = express();

  // Railway terminates TLS in front of the app; needed for correct client IPs and secure cookies.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    pinoHttp({
      logger: ctx.logger,
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      // Log only what's needed to trace a request; headers can carry cookies and tokens.
      serializers: {
        req: (req: { id: unknown; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          // Reset tokens never appear in API URLs, but strip query strings anyway.
          url: req.url.split('?')[0],
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  app.use('/api/health', healthRouter(checkDatabase, version));

  const api = express.Router();
  api.use(
    rateLimit({
      windowMs: 60_000,
      limit: apiRateLimit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      // Same error format as every other API error, so the client can show a message.
      handler: (_req, res) => {
        res.status(429).json({ error: { code: 'too_many_requests' } });
      },
    }),
  );
  api.use(requireSameOrigin(ctx.config.appUrl));
  api.use(express.json({ limit: '100kb' }));
  api.use(cookieParser());
  api.use(loadSession(ctx));
  api.use('/auth', authRouter(ctx, { rateLimit: authRateLimit }));
  api.use('/me', meRouter(ctx));
  api.use('/users', usersRouter(ctx));
  api.use(catalogRouter(ctx));
  api.use(trainingRouter(ctx));
  api.use(statsRouter(ctx));
  api.use(goalsRouter(ctx));
  api.use(reportsRouter(ctx));
  app.use('/api/v1', api);
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
