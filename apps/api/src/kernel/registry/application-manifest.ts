/**
 * Application SDK - the single, frozen contract every Grovyn Platform application
 * implements. Engineering, Platform Administration and Business Operations all use this
 * exact shape; there are no special cases. Adding a new application means writing a
 * `*.manifest.ts` (this shape) and a `*.module.ts` (registers it) - nothing in the shell
 * or registry changes.
 */

/** Lifecycle/visibility status of an application. The launcher understands each of these. */
export enum ApplicationStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
  MAINTENANCE = 'MAINTENANCE',
  EXPERIMENTAL = 'EXPERIMENTAL',
  COMING_SOON = 'COMING_SOON',
}

/** Launcher grouping dimension. The launcher groups apps automatically by category. */
export type ApplicationCategory =
  | 'platform'
  | 'operations'
  | 'engineering'
  | 'sales'
  | 'finance'
  | 'people'
  | 'support'
  | 'ai';

/** Platform-level role (distinct from any organization role). */
export type PlatformRole = 'SUPER_ADMIN';

export interface AppNavItem {
  label: string;
  path: string;
  /** lucide-react export name; the frontend maps it to a component. */
  icon: string;
  exact?: boolean;
}

export interface ApplicationManifest {
  /** Stable identifier (may equal `key`). */
  id: string;
  /** Unique machine key. */
  key: string;
  name: string;
  description: string;
  /** lucide-react export name for the application's own icon. */
  icon: string;
  category: ApplicationCategory;
  /** Deterministic ordering in launcher/nav (lower first). */
  order: number;
  /** URL prefix the app owns. */
  routePrefix: string;
  /** Semver of the application. */
  version: string;
  /** Owning team. */
  owner: string;
  /** Feature flag that gates availability. Absent = always available. */
  featureFlag?: string;
  /** Only a platform SUPER_ADMIN may see/enter this app. */
  requiresSuperAdmin?: boolean;
  /** Minimum platform role required (null = any authenticated user). */
  minimumPlatformRole?: PlatformRole | null;
  /** Declared status. The registry may downgrade it to DISABLED via the feature flag. */
  status: ApplicationStatus;
  /** false = platform chrome nav (e.g. Settings) that is always present but never a
   *  launcher card. Defaults to true. */
  showInLauncher?: boolean;
  navigation: AppNavItem[];

  // --- Extension points: interfaces only, empty until their phase. ---
  permissions: string[]; // future: `app:resource:action`
  dependencies: string[]; // future: keys of apps this one depends on
  events: string[]; // future: integration event types
  aiTools: string[]; // future: AI tool ids exposed to agents
}

export interface ApplicationHealth {
  status: 'ok' | 'degraded' | 'down';
  application: string;
  details?: Record<string, unknown>;
}

export interface ApplicationCapabilities {
  key: string;
  version: string;
  status: ApplicationStatus;
  navigation: AppNavItem[];
  permissions: string[];
  dependencies: string[];
  events: string[];
  aiTools: string[];
}

/**
 * The uniform lifecycle every application exposes. Business logic is NOT implemented here
 * yet - {@link BaseApplication} provides sensible defaults derived from the manifest.
 */
export interface PlatformApplication {
  readonly manifest: ApplicationManifest;
  register(): ApplicationManifest;
  boot(): void | Promise<void>;
  health(): ApplicationHealth;
  capabilities(): ApplicationCapabilities;
}
