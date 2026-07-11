import { ApplicationManifest, ApplicationStatus } from './application-manifest';
import { BaseApplication } from './base-application';

/**
 * The platform's own baseline navigation (Settings). Modeled as a normal application so
 * the shell's nav is 100% registry-driven, but `showInLauncher: false` marks it as
 * platform chrome - always present in the sidebar, never a launcher card.
 */
export const CORE_MANIFEST: ApplicationManifest = {
  id: 'core',
  key: 'core',
  name: 'Workspace',
  description: 'Personal and organization settings.',
  icon: 'Settings',
  category: 'platform',
  order: 90,
  routePrefix: '/settings',
  version: '1.0.0',
  owner: 'Platform',
  requiresSuperAdmin: false,
  minimumPlatformRole: null,
  status: ApplicationStatus.ACTIVE,
  showInLauncher: false,
  navigation: [{ label: 'Settings', path: '/settings', icon: 'Settings' }],
  permissions: [],
  dependencies: [],
  events: [],
  aiTools: [],
};

export class CoreApplication extends BaseApplication {
  readonly manifest = CORE_MANIFEST;
}

export const coreApplication = new CoreApplication();
