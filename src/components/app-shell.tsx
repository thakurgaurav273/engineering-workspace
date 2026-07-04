import { type ReactNode, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, ClipboardCheck, Target, FileText, ListChecks,
  Sparkles, Trophy, Settings, Search, Command, Sun, Moon, ChevronsUpDown, Menu, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getStoredAuth, clearAuth, getPushToken, clearPushToken } from "@/lib/auth";
import { userInitials, avatarColor } from "@/lib/transforms";
import { useTheme } from "@/lib/theme";
import { notificationsApi } from "@/lib/notifications";
import { useNotificationSocket, useForegroundPush } from "@/hooks/use-notifications";
import { NotificationsBell } from "@/components/notifications-bell";

const nav = [
  { group: "Engineering", items: [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { to: "/people", label: "People", icon: Users },
    { to: "/checkins", label: "Check-ins", icon: ClipboardCheck },
    { to: "/task-updates", label: "Task Updates", icon: ListChecks },
    { to: "/goals", label: "Goals", icon: Target },
    { to: "/reviews", label: "Reviews", icon: FileText },
    { to: "/recognition", label: "Recognition", icon: Sparkles },
    { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  ]},
  { group: "Workspace", items: [
    { to: "/settings", label: "Settings", icon: Settings },
  ]},
];

export function AppShell({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const { isDark, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const auth = getStoredAuth();
  const user = auth?.user;
  const displayName = user ? `${user.firstName} ${user.lastName}` : '—';
  const displayInitials = user ? userInitials(user.firstName, user.lastName) : '??';
  const displayEmail = user?.email ?? '';
  const avatarBg = user ? avatarColor(user.id) : 'bg-indigo-500';

  useNotificationSocket();
  useForegroundPush();

  const handleLogout = () => {
    const pushToken = getPushToken();
    if (pushToken) {
      notificationsApi.unregisterDevice(pushToken).catch(() => {});
      clearPushToken();
    }
    clearAuth();
    navigate({ to: '/login' });
  };

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  const SidebarInner = (
    <div className="flex h-full flex-col w-full">
      <div className="flex h-14 items-center gap-2 px-5 border-b border-border">
        <img src="/grovyn_logo.png" alt="Grovyn" className="h-7 w-7 rounded-md object-contain" />
        <div className="flex flex-col leading-tight">
          <span className="text-[13px] font-semibold tracking-tight">Grovyn One</span>
          <span className="text-[10.5px] text-muted-foreground">Engineering</span>
        </div>
        <ChevronsUpDown className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {nav.map(g => (
          <div key={g.group}>
            <div className="px-2 mb-1.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">{g.group}</div>
            <ul className="space-y-0.5">
              {g.items.map(i => {
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
                      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-foreground" : "text-muted-foreground")} />
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
          <div className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-white text-[11px] font-semibold", avatarBg)}>
            {displayInitials}
          </div>
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
          <aside className="absolute inset-y-0 left-0 w-[260px] bg-sidebar border-r border-border animate-slide-in-right" style={{ animation: "fade-in 0.2s ease-out" }}>
            {SidebarInner}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 backdrop-blur px-4 lg:px-6">
          <button className="lg:hidden -ml-1 grid h-8 w-8 place-items-center rounded-md hover:bg-accent" onClick={() => setMobileOpen(true)}>
            <Menu className="h-4 w-4" />
          </button>
          <div className="hidden md:flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <span>Grovyn</span>
            <span className="text-border">/</span>
            <span className="text-foreground font-medium">{pageLabel(pathname)}</span>
          </div>
          <div className="flex-1" />
          <div className="hidden md:flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 min-w-[280px] text-muted-foreground">
            <Search className="h-3.5 w-3.5" />
            <input className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground" placeholder="Search people, goals, check-ins…" />
            <kbd className="hidden lg:flex items-center gap-0.5 rounded border border-border px-1.5 py-0.5 text-[10px] font-mono-num">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </div>
          <NotificationsBell />
          <button className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent text-muted-foreground" onClick={() => setTheme(isDark ? "light" : "dark")}>
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <div className={cn("grid h-8 w-8 place-items-center rounded-full text-white text-[11px] font-semibold", avatarBg)}>
            {displayInitials}
          </div>
        </header>

        <div className="flex min-w-0 flex-1 overflow-hidden">
          <main className="min-w-0 flex-1 overflow-y-auto">
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
