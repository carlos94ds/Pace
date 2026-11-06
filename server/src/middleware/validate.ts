import type { Request } from 'express';
import type { z } from 'zod';
import { HttpError } from './errors';

/** Custom checks carry their own code as message (e.g. 'in_future'); others use Zod's code. */
export const issueCode = (issue: z.core.$ZodIssue) =>
  issue.code === 'custom' && /^[a-z_]+$/.test(issue.message) ? issue.message : issue.code;

/** Parses the request body; on failure responds 400 with one error code per field. */
export function parseBody<T extends z.ZodType>(schema: T, req: Request): z.infer<T> {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || '_';
      fields[path] ??= issueCode(issue);
    }
    throw new HttpError(400, 'validation_error', fields);
  }
  return result.data;
}

/** Same as parseBody, for query strings (`?from=…&to=…`). */
export function parseQuery<T extends z.ZodType>(schema: T, req: Request): z.infer<T> {
  return parseBody(schema, { body: req.query } as Request);
}
