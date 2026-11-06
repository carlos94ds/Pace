import type { AppContext } from '../context';
import { processFileDeletions } from '../lib/file-deletions';

const EVERY_15_MINUTES = 15 * 60 * 1000;

/**
 * Background jobs. Runs inside the app process, so the Railway service must stay at one
 * replica (or the jobs need a database lock) — see docs/ARCHITECTURE.md.
 */
export function startScheduler(ctx: AppContext): () => void {
  const run = async () => {
    try {
      const deleted = await processFileDeletions(ctx);
      if (deleted > 0) ctx.logger.info({ deleted }, 'Retried file deletions');
    } catch (err) {
      ctx.logger.error({ err }, 'Scheduled job failed');
    }
  };
  void run();
  const timer = setInterval(run, EVERY_15_MINUTES);
  return () => clearInterval(timer);
}
