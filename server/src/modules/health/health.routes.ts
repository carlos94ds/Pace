import type { HealthResponse } from '@pace/shared';
import { Router } from 'express';

export function healthRouter(checkDatabase: () => Promise<boolean>, version: string): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const dbUp = await checkDatabase();
    const body: HealthResponse = {
      status: dbUp ? 'ok' : 'degraded',
      database: dbUp ? 'up' : 'down',
      version,
      time: new Date().toISOString(),
    };
    res.status(dbUp ? 200 : 503).json(body);
  });

  return router;
}
