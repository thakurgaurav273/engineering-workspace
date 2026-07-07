import { getAccessToken, getRefreshToken, getStoredAuth, storeAuth, clearAuth } from '@/platform/auth/auth';

// VITE_API_URL points at the backend directly (needed when frontend/backend are
// deployed on separate domains, e.g. tracker.grovyn.in / tracker-api.grovyn.in).
// Unset in local dev: client falls back to the Vite `/api` proxy, SSR falls back
// to the backend running on localhost.
const apiUrl = process.env.NEXT_PUBLIC_API_URL as string | undefined;
const BASE = apiUrl || (typeof window !== 'undefined' ? '/api' : 'http://localhost:3001');

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
  // helper) rather than { success, message, data } - flatten meta into the shape
  // callers expect (Paginated<T> = { data, total, page, limit, totalPages }).
  if (json.meta !== undefined) {
    return { data: json.data, ...json.meta } as T;
  }
  // Unwrap ResponseEnvelope
  return (json.data !== undefined ? json.data : json) as T;
}

// Downloads a file-response endpoint (e.g. a CSV export) and triggers a save-as in
// the browser. Mirrors request()'s 401-refresh-and-retry flow, but reads a Blob
// instead of JSON since these endpoints bypass the {success, data} envelope.
async function downloadFile(path: string, fallbackFilename: string): Promise<void> {
  const doFetch = (token: string | null) =>
    fetch(`${BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

  let res = await doFetch(getAccessToken());

  if (res.status === 401) {
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

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const json = await res.json();
      message = json.message ?? message;
    } catch {
      // response wasn't JSON - stick with the generic HTTP status message
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition');
  const filename = disposition?.match(/filename="?([^"]+)"?/)?.[1] ?? fallbackFilename;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  download: downloadFile,
};

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
