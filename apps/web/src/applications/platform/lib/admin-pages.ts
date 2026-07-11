// Metadata for the Platform Administration placeholder pages. The nav itself comes from
// the backend manifest (labels/paths/icons); this supplies the human explanation of what
// each page will eventually become. Keyed by the path segment after `/admin`
// ("dashboard" is the index).

export interface AdminPageMeta {
  title: string;
  description: string;
}

export const ADMIN_PAGES: Record<string, AdminPageMeta> = {
  dashboard: {
    title: "Platform Dashboard",
    description:
      "Platform-wide health at a glance: tenants, active applications, users, and usage.",
  },
  tenants: {
    title: "Tenants",
    description:
      "Create, suspend, and manage tenants — the top-level billing and isolation boundary.",
  },
  organizations: {
    title: "Organizations",
    description: "Browse and manage every organization across all tenants.",
  },
  applications: {
    title: "Applications",
    description:
      "Install, remove, enable, and configure applications from the registry per tenant.",
  },
  users: {
    title: "Users",
    description: "Platform-wide user directory and the assignment of platform administrators.",
  },
  access: {
    title: "App Access",
    description:
      "Grant or revoke each application per user. Members see an app only when it is granted.",
  },
  roles: {
    title: "Roles",
    description: "Define system and custom roles once the permission engine lands.",
  },
  permissions: {
    title: "Permissions",
    description: "Inspect the permission catalog synced from every application manifest.",
  },
  "feature-flags": {
    title: "Feature Flags",
    description: "Configure platform, tenant, and app feature flags without a deploy.",
  },
  audit: {
    title: "Audit",
    description: "Platform-wide, immutable audit trail of who did what, where, and when.",
  },
  storage: {
    title: "Storage",
    description: "Object storage usage and document/artifact inventory per tenant.",
  },
  monitoring: {
    title: "Monitoring",
    description: "Service health, background jobs, and AI usage & spend across the platform.",
  },
  settings: {
    title: "Platform Settings",
    description: "Global configuration for the Grovyn Platform operating system.",
  },
};
