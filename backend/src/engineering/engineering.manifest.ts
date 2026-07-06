import { ApplicationManifest } from '../kernel/registry/application-manifest';

/**
 * Engineering — Application #1. The nav mirrors exactly what the shell hardcoded before
 * the registry existed (same labels, paths, icons, order), so registry-driven navigation
 * renders identically. `routePrefix` is `/` because Engineering is the incumbent app and
 * keeps its flat routes; re-prefixing is a later, redirect-gated task.
 */
export const ENGINEERING_MANIFEST: ApplicationManifest = {
  key: 'engineering',
  name: 'Engineering',
  description: 'Check-ins, goals, reviews, recognition, people and workspace.',
  category: 'engineering',
  routePrefix: '/',
  navGroup: 'Engineering',
  order: 10,
  enabled: true,
  permissions: [],
  nav: [
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
};
