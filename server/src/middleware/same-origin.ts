import type { RequestHandler } from 'express';
import { HttpError } from './errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection on top of SameSite=Lax cookies: browsers always send Origin on
 * state-changing requests, and it must be this site. APP_URL counts as this site too,
 * because behind the development proxy the Host header is the API's own address.
 */
export function requireSameOrigin(appUrl: string): RequestHandler {
  const appHost = new URL(appUrl).host;
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.get('origin');
    if (!origin) return next();
    let host: string;
    try {
      host = new URL(origin).host;
    } catch {
      return next(new HttpError(403, 'cross_origin'));
    }
    if (host !== appHost && host !== req.get('host'))
      return next(new HttpError(403, 'cross_origin'));
    next();
  };
}
