// Frontend feature flags. Same intent as the backend FeatureFlagService (T003):
// env-driven, off by default, so new behavior is strictly opt-in and every existing
// flow stays byte-identical until a flag is explicitly turned on.

function readFlag(value: unknown): boolean {
  return value === true || value === "true" || value === "1";
}

export const flags = {
  /** Registry-driven navigation (Engineering as App #1). Off by default. */
  registryNav: readFlag(import.meta.env.VITE_FLAG_REGISTRY_NAV),
  /** Application-agnostic platform shell: launcher + active-app sidebar. Off by default. */
  platformShell: readFlag(import.meta.env.VITE_FLAG_PLATFORM_SHELL),
};
