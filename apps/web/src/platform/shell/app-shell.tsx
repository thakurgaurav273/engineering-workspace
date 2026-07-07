import { type ReactNode, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Target,
  FileText,
  ListChecks,
  ListTodo,
  Sparkles,
  Trophy,
  Settings,
  Search,
  Command,
  Sun,
  Moon,
  ChevronsUpDown,
  Menu,
  LogOut,
  Check,
  Loader2,
} from "lucide-react";
import { cn } from "@grovyn/utils";
import { getStoredAuth, clearAuth, getPushToken, clearPushToken } from "@/platform/auth/auth";
import { userInitials, avatarColor } from "@grovyn/utils";
import { useTheme } from "@/shared/lib/theme";
import { notificationsApi } from "@/shared/lib/notifications";
import { useNotificationSocket, useForegroundPush } from "@/shared/hooks/use-notifications";
import { NotificationsBell } from "@/platform/shell/notifications-bell";
import { useOrganization } from "@/platform/auth/organization-context";
import { Popover, PopoverTrigger, PopoverContent } from "@grovyn/ui/components/popover";
import { CommandPalette } from "@/platform/shell/command-palette";
import { Avatar } from "@grovyn/ui/primitives";
import { flags } from "@/shared/lib/flags";
import { useApplications, buildNavGroups } from "@/platform/registry/app-registry";
import { useApplication } from "@/platform/registry/application-context";

// Static fallback navigation. Used when the registryNav flag is off, or as a safety net
// if the registry hasn't loaded yet — so the sidebar is never empty. The registry's
// Engineering + core manifests are an exact mirror of this list.
const FALLBACK_NAV = [
  {
    group: "Engineering",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/workspace", label: "My Workspace", icon: ListTodo },
      { to: "/people", label: "People", icon: Users },
      { to: "/checkins", label: "Check-ins", icon: ClipboardCheck },
      { to: "/task-updates", label: "Task Updates", icon: ListChecks },
      { to: "/goals", label: "Goals", icon: Target },
      { to: "/reviews", label: "Reviews", icon: FileText },
      { to: "/recognition", label: "Recognition", icon: Sparkles },
      { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
    ],
  },
  { group: "Workspace", items: [{ to: "/settings", label: "Settings", icon: Settings }] },
];

export function AppShell({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isDark, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const auth = getStoredAuth();
  const user = auth?.user;
  const displayName = user ? `${user.firstName} ${user.lastName}` : "-";
  const displayInitials = user ? userInitials(user.firstName, user.lastName) : "??";
  const displayEmail = user?.email ?? "";
  const avatarBg = user ? avatarColor(user.id) : "bg-indigo-500";

  const { currentOrganization, organizations, switchOrganization, isSwitching } = useOrganization();
  const [orgPopoverOpen, setOrgPopoverOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useNotificationSocket();
  useForegroundPush();

  // Navigation resolution, most-specific first:
  //  1. Platform shell on + inside an app -> only the active app's nav (+ platform nav).
  //     The shell has no knowledge of Engineering; it renders the active manifest.
  //  2. Registry nav on -> all registered groups (pre-shell behaviour).
  //  3. Otherwise -> the static fallback, so the sidebar is never empty.
  const { data: registeredApps } = useApplications();
  const { activeApplication, platformNav } = useApplication();
  const navGroups =
    flags.platformShell && activeApplication
      ? buildNavGroups([activeApplication, ...platformNav])
      : flags.registryNav && registeredApps && registeredApps.length > 0
        ? buildNavGroups(registeredApps)
        : FALLBACK_NAV;

  const handleLogout = () => {
    const pushToken = getPushToken();
    if (pushToken) {
      notificationsApi.unregisterDevice(pushToken).catch(() => {});
      clearPushToken();
    }
    clearAuth();
    navigate({ to: "/login" });
  };

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  const SidebarInner = (
    <div className="flex h-full flex-col w-full">
      <div className="flex h-14 items-center gap-2 px-5 border-b border-border">
        <img
          src={currentOrganization?.logoUrl || "/grovyn_logo.png"}
          alt={currentOrganization?.name ?? "Grovyn"}
          className="h-7 w-7 rounded-md object-contain bg-muted"
          onError={(e) => {
            if (!e.currentTarget.src.endsWith("/grovyn_logo.png")) {
              e.currentTarget.src = "/grovyn_logo.png";
            }
          }}
        />
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-[13px] font-semibold tracking-tight truncate">
            {currentOrganization?.name ?? "Grovyn One"}
          </span>
          <span className="text-[10.5px] text-muted-foreground truncate">
            {currentOrganization ? "Grovyn One" : "Engineering"}
          </span>
        </div>
        {organizations.length > 1 ? (
          <Popover open={orgPopoverOpen} onOpenChange={setOrgPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded-md hover:bg-accent text-muted-foreground disabled:opacity-50"
                disabled={isSwitching}
                aria-label="Switch organization"
              >
                <ChevronsUpDown className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-1.5">
              <div className="px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                Switch organization
              </div>
              <div className="space-y-0.5">
                {organizations.map((org) => {
                  const active = org.id === currentOrganization?.id;
                  return (
                    <button
                      key={org.id}
                      disabled={isSwitching}
                      onClick={async () => {
                        setOrgPopoverOpen(false);
                        if (!active) await switchOrganization(org.id).catch(() => {});
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors disabled:opacity-50",
                        active
                          ? "bg-accent font-medium text-foreground"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                      )}
                    >
                      <Avatar
                        initials={org.name.slice(0, 2).toUpperCase()}
                        color={avatarColor(org.id)}
                        size="xs"
                        src={org.logoUrl}
                      />
                      <span className="flex-1 truncate">{org.name}</span>
                      <span className="text-[10.5px] text-muted-foreground">{org.role}</span>
                      {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <ChevronsUpDown className="ml-auto h-3.5 w-3.5 text-muted-foreground/40" />
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navGroups.map((g) => (
          <div key={g.group}>
            <div className="px-2 mb-1.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
              {g.group}
            </div>
            <ul className="space-y-0.5">
              {g.items.map((i) => {
                const active = isActive(i.to, i.exact);
                const Icon = i.icon;
                return (
                  <li key={i.to}>
                    <Link
                      to={i.to}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                        active
                          ? "bg-accent text-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active ? "text-foreground" : "text-muted-foreground",
                        )}
                      />
                      <span className="truncate">{i.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-border p-3 space-y-1">
        <div className="flex items-center gap-2.5 rounded-md p-1.5 hover:bg-accent/60 transition-colors">
          <Avatar initials={displayInitials} color={avatarBg} size="sm" src={user?.avatarUrl} />
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-medium truncate">{displayName}</div>
            <div className="text-[10.5px] text-muted-foreground truncate">{displayEmail}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden w-full bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[240px] shrink-0 border-r border-border bg-sidebar">
        {SidebarInner}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/30" onClick={() => setMobileOpen(false)} />
          <aside
            className="absolute inset-y-0 left-0 w-[260px] bg-sidebar border-r border-border animate-slide-in-right"
            style={{ animation: "fade-in 0.2s ease-out" }}
          >
            {SidebarInner}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 backdrop-blur px-4 lg:px-6">
          <button
            className="lg:hidden -ml-1 grid h-8 w-8 place-items-center rounded-md hover:bg-accent"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="hidden md:flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <span>Grovyn</span>
            <span className="text-border">/</span>
            <span className="text-foreground font-medium">{pageLabel(pathname)}</span>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden md:flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 min-w-[280px] text-muted-foreground hover:bg-accent/60 transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1 text-left text-[13px]">Search people, goals, check-ins…</span>
            <kbd className="hidden lg:flex items-center gap-0.5 rounded border border-border px-1.5 py-0.5 text-[10px] font-mono-num">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
          <NotificationsBell />
          <button
            className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent text-muted-foreground"
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Avatar initials={displayInitials} color={avatarBg} size="sm" src={user?.avatarUrl} />
        </header>

        <div className="flex min-w-0 flex-1 overflow-hidden">
          <main className="relative min-w-0 flex-1 overflow-y-auto">
            {/* Blocks the previous org's data from being seen while switchOrganization's
                query reset + refetch is in flight - lifted until that promise settles
                rather than dropped as soon as the request resolves. */}
            {isSwitching && (
              <div className="absolute inset-0 z-40 grid place-items-center bg-background/80 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Switching organization…
                </div>
              </div>
            )}
            {/* Below xl there's no separate sidebar column, so the right panel (e.g. the
                check-in/recognition submit forms) renders inline instead of disappearing. */}
            {right && <div className="xl:hidden">{right}</div>}
            {children}
          </main>
          {right && (
            <aside className="hidden xl:block w-[360px] shrink-0 border-l border-border bg-surface/40">
              {right}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

function pageLabel(p: string) {
  if (p === "/") return "Dashboard";
  const seg = p.split("/").filter(Boolean)[0] ?? "";
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}
