import type { ApiErrorBody } from '@pace/shared';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly fields: Record<string, string> = {},
  ) {
    super(code);
  }
}

type Body = Record<string, unknown> | FormData;

/** JSON fetch against our own API. Cookies are sent automatically (same origin). */
export async function api<T = void>(
  path: string,
  { method = 'GET', body }: { method?: string; body?: Body } = {},
): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: isForm ? body : body && JSON.stringify(body),
  });
  return parse<T>(res);
}

/** Health lives outside /v1 because Railway's health check calls it directly. */
export async function fetchHealth<T>(): Promise<T> {
  // 503 still carries a useful body (database down), so it isn't treated as an error.
  const res = await fetch('/api/health');
  if (res.status === 503) return (await res.json()) as T;
  return parse<T>(res);
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(res.status, body?.error.code ?? 'unknown_error', body?.error.fields);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
