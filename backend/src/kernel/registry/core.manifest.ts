import { ApplicationManifest } from './application-manifest';

/**
 * The platform's own baseline navigation (the "Workspace" group — Settings today). Kept
 * as a manifest so the shell's nav is derived entirely from the registry rather than
 * split between apps and hardcoded shell items.
 */
export const CORE_MANIFEST: ApplicationManifest = {
  key: 'core',
  name: 'Workspace',
  category: 'platform',
  routePrefix: '/settings',
  navGroup: 'Workspace',
  order: 90,
  enabled: true,
  permissions: [],
  nav: [{ label: 'Settings', path: '/settings', icon: 'Settings' }],
};
