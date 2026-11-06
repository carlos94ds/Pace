export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}

/** JSON fetch against our own API. Cookies are sent automatically (same origin). */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
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
    const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
    throw new ApiError(res.status, body?.error?.code ?? 'unknown_error');
  }
  return (await res.json()) as T;
}
