import type { ErrorRequestHandler, RequestHandler } from 'express';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, 'not_found'));
};

// Unknown errors are logged in full but only reach the client as a generic 500,
// so stack traces and SQL details never leak.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code } });
    return;
  }
  req.log.error({ err }, 'Unhandled error');
  res.status(500).json({ error: { code: 'internal_error' } });
};
