import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../lib/prisma';
import { cleanupTestUsers, makeTestApp, registeredAgent } from '../../test/helpers';
import { pruneExpiredTokens } from './housekeeping';

const { app } = makeTestApp();
afterAll(cleanupTestUsers);

describe('housekeeping', () => {
  it('removes expired sessions and old reset tokens, nothing else', async () => {
    const { me } = await registeredAgent(app);
    const now = new Date('2026-11-06T12:00:00Z');
    const day = 86_400_000;
    await prisma.authSession.createMany({
      data: [
        { userId: me.id, tokenHash: 'a'.repeat(64), expiresAt: new Date(now.getTime() - day) },
        { userId: me.id, tokenHash: 'b'.repeat(64), expiresAt: new Date(now.getTime() + day) },
      ],
    });
    await prisma.passwordResetToken.createMany({
      data: [
        { userId: me.id, tokenHash: 'c'.repeat(64), expiresAt: new Date(now.getTime() - 8 * day) },
        { userId: me.id, tokenHash: 'd'.repeat(64), expiresAt: new Date(now.getTime() - 1 * day) },
      ],
    });
    await pruneExpiredTokens(prisma, now);
    const sessions = await prisma.authSession.findMany({
      where: { userId: me.id },
      select: { tokenHash: true },
    });
    // The expired one is gone; the still valid one (and the registration session) remain.
    expect(sessions.map((s) => s.tokenHash)).not.toContain('a'.repeat(64));
    expect(sessions.map((s) => s.tokenHash)).toContain('b'.repeat(64));
    const tokens = await prisma.passwordResetToken.findMany({
      where: { userId: me.id },
      select: { tokenHash: true },
    });
    expect(tokens.map((t) => t.tokenHash)).toEqual(['d'.repeat(64)]);
  });
});
