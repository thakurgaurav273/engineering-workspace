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
  Building,
  Building2,
  ShieldCheck,
  UserCog,
  KeyRound,
  Flag,
  ScrollText,
  HardDrive,
  Activity,
  Receipt,
  CreditCard,
  FileSignature,
} from "lucide-react";
import { api } from "@/shared/lib/api";
import { flags } from "@/shared/lib/flags";
import { isAuthenticated } from "@/platform/auth/auth";

// Frontend view of the platform Application SDK. Mirrors the backend manifest exactly; the
// backend (`GET /platform/applications`) is the source of truth. Nothing here is
// app-specific — adding a new application requires no change to this file except (rarely)
// a new icon.

export enum ApplicationStatus {
  ACTIVE = "ACTIVE",
  DISABLED = "DISABLED",
  MAINTENANCE = "MAINTENANCE",
  EXPERIMENTAL = "EXPERIMENTAL",
  COMING_SOON = "COMING_SOON",
}

export type ApplicationCategory =
  "platform" | "operations" | "engineering" | "sales" | "finance" | "people" | "support" | "ai";

export const CATEGORY_LABELS: Record<ApplicationCategory, string> = {
  platform: "Platform",
  operations: "Operations",
  engineering: "Engineering",
  sales: "Sales",
  finance: "Finance",
  people: "People",
  support: "Support",
  ai: "AI",
};

export interface AppNavItemMeta {
  label: string;
  path: string;
  icon: string;
  exact?: boolean;
}

export interface ApplicationManifest {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  category: ApplicationCategory;
  order: number;
  routePrefix: string;
  version: string;
  owner: string;
  featureFlag?: string;
  requiresSuperAdmin?: boolean;
  minimumPlatformRole?: "SUPER_ADMIN" | null;
  status: ApplicationStatus;
  showInLauncher?: boolean;
  navigation: AppNavItemMeta[];
  permissions: string[];
  dependencies: string[];
  events: string[];
  aiTools: string[];
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
  Building,
  Building2,
  ShieldCheck,
  UserCog,
  KeyRound,
  Flag,
  ScrollText,
  HardDrive,
  Activity,
  Receipt,
  CreditCard,
  FileSignature,
};

export function iconFor(name: string): IconComponent {
  return ICONS[name] ?? AppWindow;
}

/** Platform chrome (Settings) — always present, never a launcher card. */
export function isPlatformNav(manifest: ApplicationManifest): boolean {
  return manifest.showInLauncher === false;
}

/** A launchable application (appears in the launcher and owns a route prefix). */
export function isLaunchable(manifest: ApplicationManifest): boolean {
  return manifest.showInLauncher !== false;
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

/** Group the given apps' nav items by category label, preserving `order`. */
export function buildNavGroups(apps: ApplicationManifest[]): NavGroup[] {
  const groups: NavGroup[] = [];
  const byGroup = new Map<string, NavGroup>();

  for (const app of [...apps].sort((a, b) => a.order - b.order)) {
    const label = CATEGORY_LABELS[app.category] ?? app.category;
    let group = byGroup.get(label);
    if (!group) {
      group = { group: label, items: [] };
      byGroup.set(label, group);
      groups.push(group);
    }
    for (const item of app.navigation) {
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

/** Fetches the visible applications. Only runs once authenticated and a shell flag is on. */
export function useApplications() {
  return useQuery<ApplicationManifest[]>({
    queryKey: ["platform", "applications"],
    queryFn: () => api.get("/platform/applications"),
    enabled: (flags.registryNav || flags.platformShell) && isAuthenticated(),
    staleTime: 5 * 60 * 1000,
  });
}
