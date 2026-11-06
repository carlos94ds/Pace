import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client';
import { withDeadlockRetry } from './transactions';

const deadlock = () =>
  new Prisma.PrismaClientKnownRequestError('Transaction failed due to a deadlock', {
    code: 'P2034',
    clientVersion: 'test',
  });

describe('withDeadlockRetry', () => {
  it('retries a transaction that lost a deadlock', async () => {
    const run = vi.fn().mockRejectedValueOnce(deadlock()).mockResolvedValueOnce('ok');
    expect(await withDeadlockRetry(run)).toBe('ok');
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('gives up after the last attempt', async () => {
    const run = vi.fn().mockRejectedValue(deadlock());
    await expect(withDeadlockRetry(run, 3)).rejects.toThrow('deadlock');
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("doesn't retry other errors", async () => {
    const run = vi.fn().mockRejectedValue(new Error('constraint failed'));
    await expect(withDeadlockRetry(run)).rejects.toThrow('constraint failed');
    expect(run).toHaveBeenCalledTimes(1);
  });
});
