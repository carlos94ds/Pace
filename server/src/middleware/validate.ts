import type { Request } from 'express';
import type { z } from 'zod';
import { HttpError } from './errors';

/** Parses the request body; on failure responds 400 with one error code per field. */
export function parseBody<T extends z.ZodType>(schema: T, req: Request): z.infer<T> {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || '_';
      fields[path] ??= issue.code;
    }
    throw new HttpError(400, 'validation_error', fields);
  }
  return result.data;
}
