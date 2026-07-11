import {
  ApplicationManifest,
  ApplicationStatus,
} from '../kernel/registry/application-manifest';
import { BaseApplication } from '../kernel/registry/base-application';

/**
 * Platform Administration — Application #0. The operating system of Grovyn Platform.
 * SUPER_ADMIN only, gated by the `platform.admin` feature flag (the registry downgrades it
 * to DISABLED when the flag is off). Pages are routing structure + placeholders for now.
 */
export const PLATFORM_ADMIN_MANIFEST: ApplicationManifest = {
  id: 'platform-admin',
  key: 'platform-admin',
  name: 'Platform Administration',
  description: 'Tenants, applications, users, audit, storage and platform settings.',
  icon: 'ShieldCheck',
  category: 'platform',
  order: 0,
  routePrefix: '/admin',
  version: '1.0.0',
  owner: 'Platform',
  featureFlag: 'platform.admin',
  requiresSuperAdmin: true,
  minimumPlatformRole: 'SUPER_ADMIN',
  status: ApplicationStatus.ACTIVE,
  navigation: [
    { label: 'Dashboard', path: '/admin', icon: 'LayoutDashboard', exact: true },
    { label: 'Tenants', path: '/admin/tenants', icon: 'Building2' },
    { label: 'Organizations', path: '/admin/organizations', icon: 'Building' },
    { label: 'Applications', path: '/admin/applications', icon: 'AppWindow' },
    { label: 'Users', path: '/admin/users', icon: 'Users' },
    { label: 'App Access', path: '/admin/access', icon: 'UserCog' },
    { label: 'Roles', path: '/admin/roles', icon: 'ShieldCheck' },
    { label: 'Permissions', path: '/admin/permissions', icon: 'KeyRound' },
    { label: 'Feature Flags', path: '/admin/feature-flags', icon: 'Flag' },
    { label: 'Audit', path: '/admin/audit', icon: 'ScrollText' },
    { label: 'Storage', path: '/admin/storage', icon: 'HardDrive' },
    { label: 'Monitoring', path: '/admin/monitoring', icon: 'Activity' },
    { label: 'Settings', path: '/admin/settings', icon: 'Settings' },
  ],
  permissions: [
    'platform:tenant:manage',
    'platform:organization:manage',
    'platform:application:manage',
    'platform:user:manage',
    'platform:role:manage',
    'platform:permission:read',
    'platform:audit:read',
    'platform:storage:read',
    'platform:feature-flag:manage',
    'platform:settings:manage',
  ],
  dependencies: [],
  events: [],
  aiTools: [],
};

export class PlatformAdminApplication extends BaseApplication {
  readonly manifest = PLATFORM_ADMIN_MANIFEST;
}

export const platformAdminApplication = new PlatformAdminApplication();
