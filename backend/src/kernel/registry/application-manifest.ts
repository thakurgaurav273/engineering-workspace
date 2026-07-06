/**
 * Application manifest (roadmap T048/T050, minimal DB-free variant). An application
 * declares itself to the platform with this shape; the {@link RegistryService} collects
 * every manifest at boot and the shell derives navigation from them. Per-tenant install
 * state (`app_installation`) is intentionally out of scope until Tenant/RLS land — for
 * now `enabled` is a static, code-level flag.
 *
 * Icons are lucide-react export *names* (strings) so the manifest stays serializable and
 * can cross the API boundary; the frontend maps the name to a component.
 */
export interface AppNavItem {
  label: string;
  path: string;
  icon: string;
  /** Active only on an exact path match (used for the Dashboard "/" root). */
  exact?: boolean;
}

export interface ApplicationManifest {
  key: string;
  name: string;
  description?: string;
  category: string;
  /** URL prefix the app owns. `/` for the incumbent Engineering app (flat routes). */
  routePrefix: string;
  /** Sidebar group heading the app's nav items render under. */
  navGroup: string;
  /** Deterministic ordering of apps in nav / launcher (lower first). */
  order: number;
  enabled: boolean;
  /** Permission keys the app owns (`app:resource:action`). Empty until Phase 4. */
  permissions: string[];
  nav: AppNavItem[];
}
