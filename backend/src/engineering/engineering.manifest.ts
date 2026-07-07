import {
  ApplicationManifest,
  ApplicationStatus,
} from '../kernel/registry/application-manifest';
import { BaseApplication } from '../kernel/registry/base-application';

/**
 * Engineering — Application #1. The nav mirrors what the shell hardcoded before the
 * registry existed. `routePrefix` is `/` because Engineering is the incumbent app.
 */
export const ENGINEERING_MANIFEST: ApplicationManifest = {
  id: 'engineering',
  key: 'engineering',
  name: 'Engineering',
  description: 'Check-ins, goals, reviews, recognition, people and workspace.',
  icon: 'LayoutDashboard',
  category: 'engineering',
  order: 10,
  routePrefix: '/',
  version: '1.0.0',
  owner: 'Engineering',
  requiresSuperAdmin: false,
  minimumPlatformRole: null,
  status: ApplicationStatus.ACTIVE,
  navigation: [
    { label: 'Dashboard', path: '/', icon: 'LayoutDashboard', exact: true },
    { label: 'My Workspace', path: '/workspace', icon: 'ListTodo' },
    { label: 'People', path: '/people', icon: 'Users' },
    { label: 'Check-ins', path: '/checkins', icon: 'ClipboardCheck' },
    { label: 'Task Updates', path: '/task-updates', icon: 'ListChecks' },
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
    'engineering:task-update:read',
    'engineering:task-update:write',
  ],
  dependencies: [],
  events: [],
  aiTools: [],
};

export class EngineeringApplication extends BaseApplication {
  readonly manifest = ENGINEERING_MANIFEST;
}

export const engineeringApplication = new EngineeringApplication();
