import type { TFunction } from 'i18next';
import type { z } from 'zod';
import { ApiError } from './api';

export type FieldErrors = Record<string, string>;

/** Runs the same Zod schema the server uses, so errors show before anything is sent. */
export function validate<T extends z.ZodType>(
  schema: T,
  values: unknown,
): { data: z.infer<T>; errors: null } | { data: null; errors: FieldErrors } {
  const result = schema.safeParse(values);
  if (result.success) return { data: result.data, errors: null };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) errors[issue.path.join('.') || '_'] ??= issue.code;
  return { data: null, errors };
}

/** Field-specific message if one exists, otherwise a generic one for the error code. */
export function fieldMessage(t: TFunction, field: string, code: string | undefined) {
  if (!code) return undefined;
  return t(`errors.fields.${field}.${code}`, {
    defaultValue: t(`errors.codes.${code}`, { defaultValue: t('errors.codes.invalid') }),
  });
}

/** A message for errors that don't belong to one field. */
export function formMessage(t: TFunction, error: unknown) {
  const code = error instanceof ApiError ? error.code : 'network_error';
  return t(`errors.api.${code}`, { defaultValue: t('errors.api.unknown_error') });
}

export function apiFieldErrors(error: unknown): FieldErrors {
  return error instanceof ApiError ? error.fields : {};
}
