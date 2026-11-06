import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { makeTestApp } from '../../test/helpers';
import { processFileDeletions, queueFileDeletions } from './file-deletions';
import { prisma } from './prisma';

describe('file deletion queue', () => {
  it('is safe when two runs handle the same files at once', async () => {
    const { ctx, storage } = makeTestApp();
    const keys = [`test/${randomUUID()}.webp`, `test/${randomUUID()}.webp`];
    for (const key of keys) await storage.put(key, Buffer.from('x'), 'image/webp');
    await prisma.$transaction((tx) => queueFileDeletions(tx, keys));

    const results = await Promise.all([
      processFileDeletions(ctx, { keys }),
      processFileDeletions(ctx, { keys }),
    ]);

    expect(results.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(2);
    expect(storage.files.size).toBe(0);
    expect(await prisma.pendingFileDeletion.count({ where: { key: { in: keys } } })).toBe(0);
  });

  it('keeps failed deletions queued for a retry', async () => {
    const { ctx } = makeTestApp();
    const key = `test/${randomUUID()}.webp`;
    ctx.storage.delete = async () => {
      throw new Error('bucket unavailable');
    };
    await prisma.$transaction((tx) => queueFileDeletions(tx, [key]));
    expect(await processFileDeletions(ctx, { keys: [key] })).toBe(0);
    const row = await prisma.pendingFileDeletion.findFirstOrThrow({ where: { key } });
    expect(row.attempts).toBe(1);
    expect(row.lastError).toContain('bucket unavailable');
    await prisma.pendingFileDeletion.delete({ where: { id: row.id } });
  });
});
