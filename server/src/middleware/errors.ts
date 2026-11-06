import type { ApiErrorBody } from '@pace/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(code);
  }
}

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, 'not_found'));
};

// Unknown errors are logged in full but only reach the client as a generic 500,
// so stack traces and SQL details never leak.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    const body: ApiErrorBody = { error: { code: err.code, fields: err.fields } };
    res.status(err.status).json(body);
    return;
  }
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    res.status(status).json({
      error: { code: err.code === 'LIMIT_FILE_SIZE' ? 'file_too_large' : 'invalid_upload' },
    });
    return;
  }
  // Malformed JSON bodies.
  if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
    res.status(400).json({ error: { code: 'invalid_body' } });
    return;
  }
  req.log.error({ err }, 'Unhandled error');
  res.status(500).json({ error: { code: 'internal_error' } });
};
