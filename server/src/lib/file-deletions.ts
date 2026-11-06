import type { AppContext } from '../context';
import type { Prisma } from '../generated/prisma/client';

const MAX_ATTEMPTS = 10;

/** Records files to delete; call inside the same transaction as the database change. */
export async function queueFileDeletions(tx: Prisma.TransactionClient, keys: string[]) {
  if (keys.length === 0) return;
  await tx.pendingFileDeletion.createMany({ data: keys.map((key) => ({ key })) });
}

/** Deletes queued files from storage. Failures stay queued and are retried by the job. */
export async function processFileDeletions(ctx: AppContext, limit = 100): Promise<number> {
  const pending = await ctx.prisma.pendingFileDeletion.findMany({
    where: { attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
  let deleted = 0;
  for (const item of pending) {
    try {
      await ctx.storage.delete(item.key);
      await ctx.prisma.pendingFileDeletion.delete({ where: { id: item.id } });
      deleted++;
    } catch (err) {
      ctx.logger.warn({ err, attempts: item.attempts + 1 }, 'File deletion failed, will retry');
      await ctx.prisma.pendingFileDeletion.update({
        where: { id: item.id },
        data: { attempts: { increment: 1 }, lastError: String(err).slice(0, 500) },
      });
    }
  }
  return deleted;
}
