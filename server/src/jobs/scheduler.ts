import type { AppContext } from '../context';
import { processFileDeletions } from '../lib/file-deletions';
import { pruneNotifications } from '../modules/notifications/notifications.routes';
import { generateDueReports } from '../modules/reports/generate';

const EVERY_15_MINUTES = 15 * 60 * 1000;

/**
 * Background jobs. Runs inside the app process, so the Railway service must stay at one
 * replica (or the jobs need a database lock) — see docs/ARCHITECTURE.md. Report creation
 * is idempotent anyway (UNIQUE userId + weekStart).
 */
export function startScheduler(ctx: AppContext): () => void {
  const job = async (name: string, task: () => Promise<number>) => {
    try {
      const count = await task();
      if (count > 0) ctx.logger.info({ count }, name);
    } catch (err) {
      ctx.logger.error({ err }, `${name} failed`);
    }
  };
  // Each job is independent: a failing one doesn't stop the others.
  const run = async () => {
    await job('Weekly reports generated', () => generateDueReports(ctx));
    await job('Retried file deletions', () => processFileDeletions(ctx));
    await job('Old read notifications removed', () => pruneNotifications(ctx.prisma));
  };
  void run();
  const timer = setInterval(run, EVERY_15_MINUTES);
  return () => clearInterval(timer);
}
