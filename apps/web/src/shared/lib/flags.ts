// Frontend feature flags. Same intent as the backend FeatureFlagService (T003):
// env-driven, off by default, so new behavior is strictly opt-in and every existing
// flow stays byte-identical until a flag is explicitly turned on.

function readFlag(value: unknown, defaultOn = false): boolean {
  if (value === undefined || value === null || value === "") return defaultOn;
  return value === true || value === "true" || value === "1";
}

export const flags = {
  /** Registry-driven navigation (Engineering as App #1). Off by default. */
  registryNav: readFlag(process.env.NEXT_PUBLIC_FLAG_REGISTRY_NAV),
  /**
   * Application-agnostic platform shell: launcher + active-app sidebar. This is the source
   * of truth for post-auth navigation, so it is ON by default; set
   * NEXT_PUBLIC_FLAG_PLATFORM_SHELL=false to fall back to the legacy Engineering-only home.
   */
  platformShell: readFlag(process.env.NEXT_PUBLIC_FLAG_PLATFORM_SHELL, true),
};
