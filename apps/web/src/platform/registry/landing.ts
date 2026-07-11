import type { ApplicationManifest } from "@/platform/registry/app-registry";

/** Sentinel preference value meaning "no default app - always show the launcher". */
export const LAUNCHER_KEY = "all";

/**
 * Resolves where an authenticated user should land (on login or when hitting `/`) from their
 * saved default-application preference and the apps they currently have access to.
 *
 * - No preference (or the sentinel "all") → the launcher (`/apps`).
 * - A preferred app the user still has access to → that app's route prefix.
 * - A preferred app the user no longer has access to → falls back to the launcher.
 */
export function resolveLandingPath(
  applications: Pick<ApplicationManifest, "key" | "routePrefix">[],
  defaultApplicationKey: string | null | undefined,
): string {
  if (!defaultApplicationKey || defaultApplicationKey === LAUNCHER_KEY) return "/apps";
  const app = applications.find((a) => a.key === defaultApplicationKey);
  return app ? app.routePrefix : "/apps";
}
