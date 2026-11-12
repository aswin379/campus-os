/**
 * Falling back to a fixed 'http://localhost:4000/api/v1' broke as soon as
 * the page was opened from anything other than that exact host (e.g. a LAN
 * IP for testing from another device, or a teammate's machine) — the
 * browser refuses to send the SameSite=Lax session cookie back on a
 * cross-site fetch, so every request after login silently 401s. Falling
 * back to the CURRENT page's own host instead means dev/LAN access works
 * automatically from whatever host the page was actually loaded from,
 * without needing to hardcode one in .env and rebuild/restart to switch.
 * Production always sets VITE_API_BASE_URL explicitly at build time (see
 * docker-compose.prod.yml), so this fallback never applies there.
 */
export const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:4000/api/v1`;

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

/**
 * The server's generic 400 handler (parseOr400) always sends the same
 * `error: 'Invalid request'` string — the actual reason lives in `details`,
 * a zod `.flatten()` shape ({ formErrors, fieldErrors }). Without this, every
 * validation failure across the whole app shows the same useless message
 * regardless of which field or rule actually failed.
 */
function describeValidationDetails(details: unknown): string | undefined {
  if (!details || typeof details !== 'object') return undefined;
  const { formErrors, fieldErrors } = details as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
  const parts: string[] = [...(formErrors ?? [])];
  for (const [field, messages] of Object.entries(fieldErrors ?? {})) {
    if (messages?.length) parts.push(`${field}: ${messages.join(', ')}`);
  }
  return parts.length ? parts.join('; ') : undefined;
}

function errorMessageFromBody(body: { error?: string; details?: unknown } | undefined, fallback: string): string {
  return describeValidationDetails(body?.details) ?? body?.error ?? fallback;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const body = res.headers.get('content-type')?.includes('application/json') ? await res.json() : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, errorMessageFromBody(body, res.statusText), body?.details);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', credentials: 'include', body: formData });
    if (res.status === 204) return undefined as T;
    const body = res.headers.get('content-type')?.includes('application/json') ? await res.json() : undefined;
    if (!res.ok) throw new ApiError(res.status, errorMessageFromBody(body, res.statusText), body?.details);
    return body as T;
  },
};
