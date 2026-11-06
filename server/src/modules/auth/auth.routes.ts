import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type Language,
} from '@pace/shared';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { AppContext } from '../../context';
import { Prisma } from '../../generated/prisma/client';
import { hashPassword, randomToken, sha256, verifyPassword } from '../../lib/crypto';
import { toApi, toDb } from '../../lib/enums';
import { HttpError } from '../../middleware/errors';
import {
  clearSessionCookie,
  currentUserId,
  requireAuth,
  startSession,
} from '../../middleware/session';
import { parseBody } from '../../middleware/validate';
import { loadMe } from '../me/me.mapper';
import { resetPasswordEmail } from './emails';

const RESET_TTL_MS = 30 * 60 * 1000;

// Verifying against a dummy hash when the email is unknown keeps login timing the same,
// so response times don't reveal which emails have an account.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword('dummy-password-for-timing'));

export function authRouter(ctx: AppContext, options: { rateLimit: number }): Router {
  const router = Router();
  const { prisma } = ctx;

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: options.rateLimit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: 'too_many_requests' } });
    },
  });

  router.post('/register', limiter, async (req, res) => {
    const input = parseBody(registerSchema, req);

    const [emailTaken, usernameTaken] = await Promise.all([
      prisma.user.findUnique({ where: { email: input.email }, select: { id: true } }),
      prisma.userProfile.findUnique({
        where: { username: input.username },
        select: { userId: true },
      }),
    ]);
    if (emailTaken || usernameTaken) {
      throw new HttpError(409, 'conflict', {
        ...(emailTaken && { email: 'taken' }),
        ...(usernameTaken && { username: 'taken' }),
      });
    }

    let userId: string;
    try {
      const user = await prisma.user.create({
        data: {
          email: input.email,
          passwordHash: await hashPassword(input.password),
          profile: {
            create: {
              username: input.username,
              firstName: input.firstName,
              timezone: input.timezone,
            },
          },
          privacy: { create: {} },
          preferences: { create: { language: toDb(input.language) } },
        },
        select: { id: true },
      });
      userId = user.id;
    } catch (err) {
      // Two registrations racing for the same email or username.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new HttpError(409, 'conflict');
      }
      throw err;
    }

    await startSession(ctx, res, userId, req.get('user-agent'));
    res.status(201).json(await loadMe(prisma, userId));
  });

  router.post('/login', limiter, async (req, res) => {
    const input = parseBody(loginSchema, req);
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, passwordHash: true },
    });
    const valid = user
      ? await verifyPassword(user.passwordHash, input.password)
      : await verifyPassword(await getDummyHash(), input.password).then(() => false);
    if (!user || !valid) throw new HttpError(401, 'invalid_credentials');

    await startSession(ctx, res, user.id, req.get('user-agent'));
    res.json(await loadMe(prisma, user.id));
  });

  router.post('/logout', async (req, res) => {
    if (req.auth) {
      await prisma.authSession.deleteMany({ where: { id: req.auth.sessionId } });
    }
    clearSessionCookie(ctx, res);
    res.status(204).end();
  });

  router.post('/logout-all', requireAuth, async (req, res) => {
    await prisma.authSession.deleteMany({ where: { userId: currentUserId(req) } });
    clearSessionCookie(ctx, res);
    res.status(204).end();
  });

  router.post('/forgot-password', limiter, async (req, res) => {
    const { email } = parseBody(forgotPasswordSchema, req);
    // Always the same answer, whether or not the email has an account.
    res.status(204).end();

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        profile: { select: { firstName: true } },
        preferences: { select: { language: true } },
      },
    });
    if (!user) return;

    const token = randomToken();
    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
      prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + RESET_TTL_MS),
        },
      }),
    ]);

    const link = `${ctx.config.appUrl}/reset-password?token=${token}`;
    const language = toApi<Language>(user.preferences?.language ?? 'EN');
    const mail = resetPasswordEmail(language, user.profile?.firstName ?? '', link);
    await ctx.mailer
      .send({ to: user.email, ...mail })
      .catch((err) => req.log.error({ err }, 'Password reset email failed'));
  });

  router.post('/reset-password', limiter, async (req, res) => {
    const input = parseBody(resetPasswordSchema, req);
    const token = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha256(input.token) },
    });
    if (!token || token.usedAt || token.expiresAt.getTime() <= Date.now()) {
      throw new HttpError(400, 'invalid_token');
    }

    const passwordHash = await hashPassword(input.password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: token.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
      // Whoever knew the old password is logged out everywhere.
      prisma.authSession.deleteMany({ where: { userId: token.userId } }),
    ]);
    clearSessionCookie(ctx, res);
    res.status(204).end();
  });

  return router;
}
