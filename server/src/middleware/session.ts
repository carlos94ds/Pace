import type { CookieOptions, RequestHandler, Response } from 'express';
import type { AppContext } from '../context';
import { randomToken, sha256 } from '../lib/crypto';
import { HttpError } from './errors';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RENEW_AFTER_MS = 60 * 60 * 1000;

export function sessionCookieName(ctx: AppContext) {
  // __Host- cookies can only be set over HTTPS, for this exact host, on path "/".
  return ctx.config.production ? '__Host-pace_session' : 'pace_session';
}

function cookieOptions(ctx: AppContext): CookieOptions {
  return { httpOnly: true, secure: ctx.config.production, sameSite: 'lax', path: '/' };
}

export async function startSession(
  ctx: AppContext,
  res: Response,
  userId: string,
  userAgent: string | undefined,
) {
  const token = randomToken();
  await ctx.prisma.authSession.create({
    data: {
      userId,
      tokenHash: sha256(token),
      userAgent: userAgent?.slice(0, 255),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  res.cookie(sessionCookieName(ctx), token, { ...cookieOptions(ctx), maxAge: SESSION_TTL_MS });
}

export function clearSessionCookie(ctx: AppContext, res: Response) {
  res.clearCookie(sessionCookieName(ctx), cookieOptions(ctx));
}

/** Resolves the session cookie to a user. Sessions slide: active use keeps them alive. */
export function loadSession(ctx: AppContext): RequestHandler {
  return async (req, res, next) => {
    const token: unknown = req.cookies?.[sessionCookieName(ctx)];
    if (typeof token !== 'string' || token.length > 100) return next();

    const session = await ctx.prisma.authSession.findUnique({
      where: { tokenHash: sha256(token) },
      select: { id: true, userId: true, expiresAt: true, lastUsedAt: true },
    });
    const now = Date.now();
    if (!session || session.expiresAt.getTime() <= now) {
      if (session) await ctx.prisma.authSession.delete({ where: { id: session.id } });
      clearSessionCookie(ctx, res);
      return next();
    }

    if (now - session.lastUsedAt.getTime() > RENEW_AFTER_MS) {
      await ctx.prisma.authSession.update({
        where: { id: session.id },
        data: { lastUsedAt: new Date(now), expiresAt: new Date(now + SESSION_TTL_MS) },
      });
      res.cookie(sessionCookieName(ctx), token, { ...cookieOptions(ctx), maxAge: SESSION_TTL_MS });
    }

    req.auth = { userId: session.userId, sessionId: session.id };
    next();
  };
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(new HttpError(401, 'unauthenticated'));
  next();
};

/** The logged-in user's id. Only call behind requireAuth. */
export function currentUserId(req: { auth?: { userId: string } }): string {
  if (!req.auth) throw new HttpError(401, 'unauthenticated');
  return req.auth.userId;
}
