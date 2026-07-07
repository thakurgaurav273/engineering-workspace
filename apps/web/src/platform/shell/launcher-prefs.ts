import { useCallback, useEffect, useState } from "react";

/**
 * Per-user launcher preferences persisted in localStorage. Purely a UX convenience layer —
 * it stores no authority (favourites, last-opened timestamps, previous-visit time) and never
 * affects which applications a user can see. Registry + permissions remain the source of truth.
 */
export interface LauncherPrefs {
  favourites: string[];
  lastOpened: Record<string, string>; // appKey -> ISO timestamp
  lastVisit: string | null; // previous session's visit time, shown as "Last login"
}

const KEY = "grovyn.launcher.prefs";
const EMPTY: LauncherPrefs = { favourites: [], lastOpened: {}, lastVisit: null };

function read(): LauncherPrefs {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<LauncherPrefs>;
    return {
      favourites: Array.isArray(parsed.favourites) ? parsed.favourites : [],
      lastOpened: parsed.lastOpened && typeof parsed.lastOpened === "object" ? parsed.lastOpened : {},
      lastVisit: typeof parsed.lastVisit === "string" ? parsed.lastVisit : null,
    };
  } catch {
    return EMPTY;
  }
}

function write(prefs: LauncherPrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* quota / private mode — favourites are best-effort */
  }
}

export function useLauncherPrefs() {
  // Start empty so SSR and the first client render agree; hydrate from storage after mount.
  const [prefs, setPrefs] = useState<LauncherPrefs>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  // `lastVisit` is captured once on mount, before we overwrite it with "now".
  const [lastLogin, setLastLogin] = useState<string | null>(null);

  useEffect(() => {
    const stored = read();
    setPrefs(stored);
    setLastLogin(stored.lastVisit);
    setHydrated(true);
    // Stamp this visit so the next session can show it as "Last login".
    write({ ...stored, lastVisit: new Date().toISOString() });
  }, []);

  const persist = useCallback((next: LauncherPrefs) => {
    setPrefs(next);
    write(next);
  }, []);

  const toggleFavourite = useCallback(
    (key: string) => {
      setPrefs((prev) => {
        const has = prev.favourites.includes(key);
        const favourites = has ? prev.favourites.filter((k) => k !== key) : [...prev.favourites, key];
        const next = { ...prev, favourites };
        write(next);
        return next;
      });
    },
    [],
  );

  const recordOpen = useCallback((key: string) => {
    setPrefs((prev) => {
      const next = { ...prev, lastOpened: { ...prev.lastOpened, [key]: new Date().toISOString() } };
      write(next);
      return next;
    });
  }, []);

  return { prefs, hydrated, lastLogin, toggleFavourite, recordOpen, persist };
}

/** "3h ago", "yesterday", "Apr 2" — compact, undefined-safe relative time. */
export function relativeTime(iso?: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "yesterday";
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
