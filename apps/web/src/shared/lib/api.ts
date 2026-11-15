import {
  getAccessToken,
  getRefreshToken,
  getStoredAuth,
  storeAuth,
  clearAuth,
} from "@/platform/auth/auth";
import { validationReasons } from "@/shared/lib/validation-messages";

// VITE_API_URL points at the backend directly (needed when frontend/backend are
// deployed on separate domains, e.g. tracker.grovyn.in / tracker-api.grovyn.in).
// Unset in local dev: client falls back to the Vite `/api` proxy, SSR falls back
// to the backend running on localhost.
const apiUrl = process.env.NEXT_PUBLIC_API_URL as string | undefined;
const BASE = apiUrl || (typeof window !== "undefined" ? "/api" : "http://localhost:3001");

let refreshing: Promise<boolean> | null = null;

// --- Acting-as-tenant override (Platform Administration global tenant switcher) ---
// When a super-admin picks a tenant, every org-scoped request carries `X-Org-Id` so the
// backend rescopes it to that org (see api's JwtStrategy). The override is a module-global
// set by AdminTenantProvider; it is cleared when the operator leaves the admin center.
let actingOrgId: string | undefined;

/** Set (or clear, with `undefined`) the tenant every org-scoped request acts on. */
export function setActingOrg(orgId?: string): void {
  actingOrgId = orgId || undefined;
}

// The operator's own identity/launcher/notifications must stay pinned to their HOME org even
// while viewing another tenant - otherwise the shell's app switcher, nav and unread counts
// would rescope to the viewed org. These endpoints therefore never carry the override.
const IDENTITY_PREFIXES = [
  "/auth",
  "/platform/applications",
  "/platform/organizations",
  "/notifications",
];

function actingOrgHeader(path: string): Record<string, string> {
  if (!actingOrgId) return {};
  if (
    IDENTITY_PREFIXES.some(
      (p) => path === p || path.startsWith(p + "/") || path.startsWith(p + "?"),
    )
  ) {
    return {};
  }
  return { "X-Org-Id": actingOrgId };
}

async function tryRefresh(): Promise<boolean> {
  const rt = getRefreshToken();
  if (!rt) {
    clearAuth();
    return false;
  }

  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) {
      clearAuth();
      return false;
    }
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

/**
 * A failed API call. `details` carries the server's structured `errors` (validation, issues…).
 * For a validation failure the message is the reasons in plain English ("Summary must be at
 * least 10 characters.") rather than the server's bare "Validation failed", so anything that
 * shows `error.message` tells the person what to fix. Report failures with `toastError`.
 */
export class ApiError extends Error {
  /** Plain-English validation reasons, one per broken rule (empty for other errors). */
  readonly reasons: string[];

  constructor(
    message: string,
    readonly status: number,
    readonly details?: Record<string, unknown>,
  ) {
    super(validationReasons(details).join(" ") || message);
    this.name = "ApiError";
    this.reasons = validationReasons(details);
  }
}

/** The API's response envelope ({ success, message, data, meta, errors }). */
interface Envelope {
  message?: string;
  errors?: Record<string, unknown>;
  data?: unknown;
  meta?: Record<string, unknown>;
}

/** The JSON body of a response, or null when there is none (an HTML error page, an empty 204). */
async function readJson(res: Response): Promise<Envelope | null> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const doFetch = (token: string | null) =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...actingOrgHeader(path),
        ...(init.headers ?? {}),
      },
    });

  let res = await doFetch(getAccessToken());

  if (res.status === 401 && !path.includes("/auth/")) {
    if (!refreshing) {
      refreshing = tryRefresh().finally(() => {
        refreshing = null;
      });
    }
    const ok = await refreshing;
    if (!ok) {
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new Error("Session expired");
    }
    res = await doFetch(getAccessToken());
  }

  const json = await readJson(res);
  if (!res.ok) throw new ApiError(json?.message ?? `HTTP ${res.status}`, res.status, json?.errors);
  if (!json) return undefined as T;
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
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...actingOrgHeader(path),
      },
    });

  let res = await doFetch(getAccessToken());

  if (res.status === 401) {
    if (!refreshing) {
      refreshing = tryRefresh().finally(() => {
        refreshing = null;
      });
    }
    const ok = await refreshing;
    if (!ok) {
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new Error("Session expired");
    }
    res = await doFetch(getAccessToken());
  }

  if (!res.ok) {
    const json = await readJson(res);
    throw new ApiError(json?.message ?? `HTTP ${res.status}`, res.status, json?.errors);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition");
  const filename = disposition?.match(/filename="?([^"]+)"?/)?.[1] ?? fallbackFilename;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  download: downloadFile,
};

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
