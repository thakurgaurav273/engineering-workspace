import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  useApplications,
  isLaunchable,
  isPlatformNav,
  type ApplicationManifest,
} from "@/platform/registry/app-registry";

/**
 * Single source of truth for "which application am I in". The shell reads everything it
 * needs about applications from here — it knows nothing about Engineering (or any
 * specific app) directly. Fed entirely by the Application Registry.
 */
export interface ApplicationContextValue {
  /** Launchable applications available to the user (from the registry). */
  applications: ApplicationManifest[];
  /** Always-present platform navigation (e.g. Settings) — not a launchable app. */
  platformNav: ApplicationManifest[];
  /** The launchable application that owns the current route, or null. */
  activeApplication: ApplicationManifest | null;
  /** Alias of {@link activeApplication} — the active app's manifest. */
  activeManifest: ApplicationManifest | null;
  isLoading: boolean;
  /**
   * Switch applications without a reload or logout. Organization, authentication and
   * permissions are untouched — only the active application (and thus the route/nav)
   * changes.
   */
  switchApplication: (key: string) => void;

  // --- Extension points: designed now, intentionally NOT implemented yet. ---
  // The shape is fixed so future features can consume the context without a breaking
  // change; persistence/behaviour arrive in later phases.
  recentApplications: ApplicationManifest[]; // reserved: most-recently-used ordering
  favouriteKeys: string[]; // reserved: user favourites
  pinnedKeys: string[]; // reserved: pinned apps
  // reserved (documented, not yet on the type to avoid dead fields):
  //   getAppNotificationCount(key) -> number      per-app notification badges
  //   getAppAssistant(key)        -> AssistantRef  per-app AI assistant
  //   command palette + deep-linking consume `applications` + `switchApplication`
}

const ApplicationContext = createContext<ApplicationContextValue | null>(null);

/** Resolve which launchable app owns a pathname: longest matching routePrefix wins. */
function resolveActive(pathname: string, apps: ApplicationManifest[]): ApplicationManifest | null {
  let best: ApplicationManifest | null = null;
  for (const app of apps) {
    const prefix = app.routePrefix;
    const matches =
      prefix === "/" ? true : pathname === prefix || pathname.startsWith(prefix + "/");
    if (matches && (!best || prefix.length > best.routePrefix.length)) {
      best = app;
    }
  }
  return best;
}

export function ApplicationProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useApplications();
  const navigate = useRouter();
  const pathname = usePathname();

  const value = useMemo<ApplicationContextValue>(() => {
    const manifests = data ?? [];
    const applications = manifests.filter(isLaunchable);
    const platformNav = manifests.filter(isPlatformNav);
    const activeApplication = resolveActive(pathname, applications);

    return {
      applications,
      platformNav,
      activeApplication,
      activeManifest: activeApplication,
      isLoading,
      switchApplication: (key: string) => {
        const app = applications.find((a) => a.key === key);
        if (app) navigate.push(app.routePrefix);
      },
      recentApplications: [],
      favouriteKeys: [],
      pinnedKeys: [],
    };
  }, [data, isLoading, pathname, navigate]);

  return <ApplicationContext.Provider value={value}>{children}</ApplicationContext.Provider>;
}

export function useApplication(): ApplicationContextValue {
  const ctx = useContext(ApplicationContext);
  if (!ctx) {
    throw new Error("useApplication must be used within an ApplicationProvider");
  }
  return ctx;
}
