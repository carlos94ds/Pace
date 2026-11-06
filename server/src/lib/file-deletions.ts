import type { AppContext } from '../context';
import type { Prisma } from '../generated/prisma/client';

const MAX_ATTEMPTS = 10;

/** Records files to delete; call inside the same transaction as the database change. */
export async function queueFileDeletions(tx: Prisma.TransactionClient, keys: string[]) {
  if (keys.length === 0) return;
  await tx.pendingFileDeletion.createMany({ data: keys.map((key) => ({ key })) });
}

/**
 * Deletes queued files from storage. Failures stay queued and are retried by the job.
 * Pass `keys` to handle only the files of the current request. It's safe to run several
 * times at once: a row another run already finished is simply skipped.
 */
export async function processFileDeletions(
  ctx: AppContext,
  { keys, limit = 100 }: { keys?: string[]; limit?: number } = {},
): Promise<number> {
  if (keys?.length === 0) return 0;
  const pending = await ctx.prisma.pendingFileDeletion.findMany({
    where: { attempts: { lt: MAX_ATTEMPTS }, ...(keys && { key: { in: keys } }) },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
  let deleted = 0;
  for (const item of pending) {
    try {
      // Deleting a file that's already gone succeeds, so a repeat is harmless.
      await ctx.storage.delete(item.key);
    } catch (err) {
      ctx.logger.warn({ err, attempts: item.attempts + 1 }, 'File deletion failed, will retry');
      await ctx.prisma.pendingFileDeletion.updateMany({
        where: { id: item.id },
        data: { attempts: { increment: 1 }, lastError: String(err).slice(0, 500) },
      });
      continue;
    }
    // deleteMany doesn't throw when another run removed the row first.
    await ctx.prisma.pendingFileDeletion.deleteMany({ where: { id: item.id } });
    deleted++;
  }
  return deleted;
}

/**
 * For request handlers: the database change is already committed, so a storage hiccup
 * must not turn it into an error response. Whatever fails is retried by the job.
 */
export async function tryProcessFileDeletions(ctx: AppContext, keys: string[]) {
  try {
    await processFileDeletions(ctx, { keys });
  } catch (err) {
    ctx.logger.warn({ err }, 'File cleanup deferred to the scheduled job');
  }
}
