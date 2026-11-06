import { Prisma } from '../generated/prisma/client';

const RETRYABLE = new Set(['P2034']); // write conflict or deadlock

/**
 * Runs a transaction again when MySQL aborted it because of a deadlock with another
 * transaction (e.g. deleting an account while reports are being generated). InnoDB
 * rolls the loser back completely, so retrying is safe.
 */
export async function withDeadlockRetry<T>(run: () => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (err) {
      const retryable =
        (err instanceof Prisma.PrismaClientKnownRequestError && RETRYABLE.has(err.code)) ||
        /deadlock/i.test(String((err as Error)?.message));
      if (!retryable || attempt >= attempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, 50 * attempt + Math.random() * 50));
    }
  }
}
