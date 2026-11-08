import type { PrismaClient } from '../generated/prisma/client';

/** Used or expired reset tokens are kept this long, for tracing a support question. */
const RESET_TOKEN_RETENTION_DAYS = 7;

/** Removes expired login sessions and old password-reset tokens. */
export async function pruneExpiredTokens(
  prisma: Pick<PrismaClient, 'authSession' | 'passwordResetToken'>,
  now = new Date(),
) {
  const cutoff = new Date(now.getTime() - RESET_TOKEN_RETENTION_DAYS * 86_400_000);
  const [sessions, tokens] = await Promise.all([
    prisma.authSession.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
  ]);
  return sessions.count + tokens.count;
}
