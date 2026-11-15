import {
  ApplicationManifest,
  ApplicationStatus,
} from '../kernel/registry/application-manifest';
import { BaseApplication } from '../kernel/registry/base-application';

/**
 * Agile Workspace - Application #1. Check-ins, goals, reviews, recognition and issues suit any
 * team, so only the display name is team-neutral: the key stays `engineering` because
 * permissions, installs, per-user grants and routes are keyed on it. `routePrefix` is `/`
 * because it is the incumbent app. People and Teams are org-wide, so they are listed in the
 * platform's Workspace group (core.manifest.ts) rather than here.
 */
export const ENGINEERING_MANIFEST: ApplicationManifest = {
  id: 'engineering',
  key: 'engineering',
  name: 'Agile Workspace',
  description: 'Check-ins, goals, reviews, recognition and issue tracking for every team.',
  icon: 'LayoutDashboard',
  category: 'productivity',
  order: 10,
  routePrefix: '/',
  version: '1.0.0',
  owner: 'Platform',
  requiresSuperAdmin: false,
  minimumPlatformRole: null,
  status: ApplicationStatus.ACTIVE,
  navigation: [
    { label: 'Dashboard', path: '/', icon: 'LayoutDashboard', exact: true },
    { label: 'My Work', path: '/workspace', icon: 'ListTodo' },
    { label: 'Check-ins', path: '/checkins', icon: 'ClipboardCheck' },
    { label: 'Issues', path: '/issues', icon: 'SquareKanban' },
    { label: 'Goals', path: '/goals', icon: 'Target' },
    { label: 'Reviews', path: '/reviews', icon: 'FileText' },
    { label: 'Recognition', path: '/recognition', icon: 'Sparkles' },
    { label: 'Leaderboard', path: '/leaderboard', icon: 'Trophy' },
  ],
  permissions: [
    'engineering:checkin:read',
    'engineering:checkin:write',
    'engineering:goal:read',
    'engineering:goal:write',
    'engineering:review:read',
    'engineering:review:write',
    'engineering:recognition:read',
    'engineering:recognition:write',
    'engineering:people:read',
    'engineering:people:manage',
  ],
  dependencies: [],
  events: [],
  aiTools: [],
};

export class EngineeringApplication extends BaseApplication {
  readonly manifest = ENGINEERING_MANIFEST;
}

export const engineeringApplication = new EngineeringApplication();
