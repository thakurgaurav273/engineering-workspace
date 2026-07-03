import { getAccessToken, getRefreshToken, getStoredAuth, storeAuth, clearAuth } from './auth';

// In dev, vite proxies /api → http://localhost:3001
// On server (SSR), use absolute URL
const BASE = typeof window !== 'undefined' ? '/api' : 'http://localhost:3001';

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const rt = getRefreshToken();
  if (!rt) { clearAuth(); return false; }

  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) { clearAuth(); return false; }
    const json = await res.json();
    const existing = getStoredAuth();
    const tokens = json.data ?? json;
    if (existing && tokens.accessToken && tokens.refreshToken) {
      storeAuth(tokens.accessToken, tokens.refreshToken, existing.user);
      return true;
    }
    clearAuth();
    return false;
  } catch {
    clearAuth();
    return false;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const doFetch = (token: string | null) =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });

  let res = await doFetch(getAccessToken());

  if (res.status === 401 && !path.includes('/auth/')) {
    if (!refreshing) {
      refreshing = tryRefresh().finally(() => { refreshing = null; });
    }
    const ok = await refreshing;
    if (!ok) {
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new Error('Session expired');
    }
    res = await doFetch(getAccessToken());
  }

  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? `HTTP ${res.status}`);
  // Paginated list endpoints return { success, data, meta } (see backend's paginate()
  // helper) rather than { success, message, data } — flatten meta into the shape
  // callers expect (Paginated<T> = { data, total, page, limit, totalPages }).
  if (json.meta !== undefined) {
    return { data: json.data, ...json.meta } as T;
  }
  // Unwrap ResponseEnvelope
  return (json.data !== undefined ? json.data : json) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
