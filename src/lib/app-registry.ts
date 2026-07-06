import { useQuery } from "@tanstack/react-query";
import type { ComponentType } from "react";
import {
  LayoutDashboard,
  ListTodo,
  Users,
  ClipboardCheck,
  ListChecks,
  Target,
  FileText,
  Sparkles,
  Trophy,
  Settings,
  AppWindow,
} from "lucide-react";
import { api } from "@/lib/api";
import { flags } from "@/lib/flags";

// Frontend view of the platform Application Registry. The backend
// (`GET /platform/applications`) is the source of truth for which apps exist and their
// nav metadata; here we map the serialized icon names back to lucide components and shape
// the data into the nav groups the shell renders.

export interface AppNavItemMeta {
  label: string;
  path: string;
  icon: string;
  exact?: boolean;
}

export interface ApplicationManifest {
  key: string;
  name: string;
  description?: string;
  category: string;
  routePrefix: string;
  navGroup: string;
  order: number;
  enabled: boolean;
  permissions: string[];
  nav: AppNavItemMeta[];
}

type IconComponent = ComponentType<{ className?: string }>;

const ICONS: Record<string, IconComponent> = {
  LayoutDashboard,
  ListTodo,
  Users,
  ClipboardCheck,
  ListChecks,
  Target,
  FileText,
  Sparkles,
  Trophy,
  Settings,
};

export function iconFor(name: string): IconComponent {
  return ICONS[name] ?? AppWindow;
}

export interface NavItem {
  to: string;
  label: string;
  icon: IconComponent;
  exact?: boolean;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

/** Group the registered apps' nav items by `navGroup`, preserving `order`. */
export function buildNavGroups(apps: ApplicationManifest[]): NavGroup[] {
  const groups: NavGroup[] = [];
  const byGroup = new Map<string, NavGroup>();

  for (const app of [...apps].sort((a, b) => a.order - b.order)) {
    let group = byGroup.get(app.navGroup);
    if (!group) {
      group = { group: app.navGroup, items: [] };
      byGroup.set(app.navGroup, group);
      groups.push(group);
    }
    for (const item of app.nav) {
      group.items.push({
        to: item.path,
        label: item.label,
        icon: iconFor(item.icon),
        exact: item.exact,
      });
    }
  }

  return groups;
}

/**
 * Fetches the enabled applications. Only runs when the `registryNav` flag is on, so with
 * the flag off there is no network call and the shell uses its static fallback nav.
 */
export function useApplications() {
  return useQuery<ApplicationManifest[]>({
    queryKey: ["platform", "applications"],
    queryFn: () => api.get("/platform/applications"),
    enabled: flags.registryNav,
    staleTime: 5 * 60 * 1000,
  });
}
