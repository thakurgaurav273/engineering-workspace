export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  orgId: string;
  jobTitle?: string | null;
  department?: string | null;
}

const ACCESS_KEY = 'grovyn_access_token';
const REFRESH_KEY = 'grovyn_refresh_token';
const USER_KEY = 'grovyn_user';

export function getStoredAuth() {
  if (typeof window === 'undefined') return null;
  const a = localStorage.getItem(ACCESS_KEY);
  const r = localStorage.getItem(REFRESH_KEY);
  const u = localStorage.getItem(USER_KEY);
  if (!a || !r || !u) return null;
  try {
    return { accessToken: a, refreshToken: r, user: JSON.parse(u) as AuthUser };
  } catch {
    return null;
  }
}

export function storeAuth(accessToken: string, refreshToken: string, user: AuthUser) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getAccessToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(ACCESS_KEY) : null;
}

export function getRefreshToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(REFRESH_KEY) : null;
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}
