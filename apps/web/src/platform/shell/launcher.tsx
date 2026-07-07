import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Command,
  Sun,
  Moon,
  Bell,
  CheckCircle2,
  Inbox,
  ListTodo,
  ArrowRight,
} from "lucide-react";
import { flags } from "@/shared/lib/flags";
import { useApplication } from "@/platform/registry/application-context";
import {
  iconFor,
  CATEGORY_LABELS,
  type ApplicationManifest,
} from "@/platform/registry/app-registry";
import { ApplicationCard } from "@/platform/shell/application-card";
import { useLauncherPrefs, relativeTime } from "@/platform/shell/launcher-prefs";
import { CommandPalette } from "@/platform/shell/command-palette";
import { getStoredAuth } from "@/platform/auth/auth";
import { useOrganization } from "@/platform/auth/organization-context";
import { useTheme } from "@/shared/lib/theme";
import { Avatar } from "@grovyn/ui/primitives";
import { userInitials, avatarColor } from "@grovyn/utils";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * The platform home screen. Flag off -> legacy Engineering home; exactly one app -> auto-enter;
 * multiple -> a personalised, registry-driven dashboard. It reads applications and their
 * metadata entirely from the Application Registry (via useApplication) — it hardcodes nothing
 * about any specific app, so it scales to CRM/HRMS/Finance/… with no changes here.
 */
export function LauncherPage() {
  const navigate = useRouter();
  const { applications, isLoading } = useApplication();
  const { prefs, hydrated, lastLogin, toggleFavourite, recordOpen } = useLauncherPrefs();
  const { currentOrganization, currentRole } = useOrganization();
  const { isDark, setTheme } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const user = getStoredAuth()?.user;

  useEffect(() => {
    if (!flags.platformShell) {
      navigate.replace("/");
      return;
    }
    if (!isLoading && applications.length === 1) {
      navigate.replace(applications[0].routePrefix);
    }
  }, [isLoading, applications, navigate]);

  // Pinned first, then registry order. Deterministic and stable across renders.
  const ordered = useMemo(() => {
    const fav = new Set(prefs.favourites);
    return [...applications].sort((a, b) => {
      const af = fav.has(a.key) ? 0 : 1;
      const bf = fav.has(b.key) ? 0 : 1;
      return af - bf || a.order - b.order;
    });
  }, [applications, prefs.favourites]);

  // "Continue where you left off": each app's registry navigation, most-recently-opened first.
  const continueGroups = useMemo(() => {
    return [...applications]
      .filter((a) => a.navigation.length > 0)
      .sort((a, b) => {
        const at = prefs.lastOpened[a.key] ? Date.parse(prefs.lastOpened[a.key]) : 0;
        const bt = prefs.lastOpened[b.key] ? Date.parse(prefs.lastOpened[b.key]) : 0;
        return bt - at || a.order - b.order;
      })
      .slice(0, 3);
  }, [applications, prefs.lastOpened]);

  if (!flags.platformShell || isLoading || applications.length <= 1) return null;

  const firstName = user?.firstName ?? "there";
  const lastLoginLabel = hydrated ? (relativeTime(lastLogin) ?? "First session") : "—";

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* ambient gradient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(60rem_40rem_at_70%_-10%,rgba(99,102,241,0.08),transparent),radial-gradient(50rem_30rem_at_0%_10%,rgba(16,185,129,0.06),transparent)]"
      />

      <header className="relative z-10 flex h-14 items-center gap-3 border-b border-border/70 px-6 backdrop-blur-sm">
        <img src="/grovyn_logo.png" alt="Grovyn" className="h-7 w-7 rounded-md object-contain bg-muted" />
        <span className="text-[13px] font-semibold tracking-tight">Grovyn Platform</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-accent"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search…</span>
            <kbd className="hidden items-center gap-0.5 rounded border border-border bg-background px-1 text-[10px] sm:inline-flex">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label="Toggle theme"
            className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {user ? (
            <Avatar
              initials={userInitials(user.firstName, user.lastName)}
              color={avatarColor(user.id)}
              size="sm"
            />
          ) : null}
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-[1400px] px-6 py-10 lg:py-14">
        {/* Welcome */}
        <section>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
            {greeting()}, {firstName} <span className="inline-block">👋</span>
          </h1>
          <p className="mt-1.5 text-[13.5px] text-muted-foreground">
            Here’s your workspace. Pick up where you left off or jump into an application.
          </p>
          <dl className="mt-5 flex flex-wrap gap-2.5">
            <MetaChip label="Organization" value={currentOrganization?.name ?? "—"} />
            <MetaChip label="Role" value={roleLabel(currentRole)} />
            <MetaChip label="Last login" value={lastLoginLabel} />
            <MetaChip label="Applications" value={String(applications.length)} />
          </dl>
        </section>

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
          {/* Left: apps + continue */}
          <div className="min-w-0 space-y-10">
            <section>
              <SectionHeader title="Your applications" hint={`${applications.length} available`} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {ordered.map((app) => (
                  <ApplicationCard
                    key={app.key}
                    app={app}
                    favourite={prefs.favourites.includes(app.key)}
                    lastOpened={prefs.lastOpened[app.key]}
                    onToggleFavourite={toggleFavourite}
                    onLaunch={(a) => recordOpen(a.key)}
                  />
                ))}
              </div>
            </section>

            {continueGroups.length > 0 ? (
              <section>
                <SectionHeader title="Continue where you left off" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {continueGroups.map((app) => (
                    <ContinueCard
                      key={app.key}
                      app={app}
                      opened={prefs.lastOpened[app.key]}
                      onNavigate={() => recordOpen(app.key)}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          {/* Right: quick actions */}
          <aside className="space-y-4">
            <SectionHeader title="Quick actions" />
            <QuickPanel icon={Bell} title="Notifications" empty="You’re all caught up" />
            <QuickPanel icon={CheckCircle2} title="Pending approvals" empty="Nothing awaiting you" />
            <QuickPanel icon={ListTodo} title="Assigned to you" empty="No open assignments" />
            <QuickPanel icon={Inbox} title="Unread" empty="Inbox zero" />
          </aside>
        </div>
      </main>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

function roleLabel(role: string | null): string {
  if (!role) return "—";
  return role.charAt(0) + role.slice(1).toLowerCase();
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5 rounded-lg border border-border bg-card/50 px-3 py-1.5 backdrop-blur-sm">
      <dt className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="max-w-[220px] truncate text-[12.5px] font-medium">{value}</dd>
    </div>
  );
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2>
      {hint ? <span className="text-[11.5px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

function ContinueCard({
  app,
  opened,
  onNavigate,
}: {
  app: ApplicationManifest;
  opened?: string | null;
  onNavigate: () => void;
}) {
  const Icon = iconFor(app.icon);
  const rel = relativeTime(opened);
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-semibold">
            {CATEGORY_LABELS[app.category] ?? app.name}
          </div>
          <div className="text-[10.5px] text-muted-foreground">{rel ? `Opened ${rel}` : app.name}</div>
        </div>
      </div>
      <ul className="space-y-0.5">
        {app.navigation.slice(0, 4).map((item) => {
          const ItemIcon = iconFor(item.icon);
          return (
            <li key={item.path}>
              <Link
                href={item.path}
                onClick={onNavigate}
                className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ItemIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
                <ArrowRight className="ml-auto h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function QuickPanel({
  icon: Icon,
  title,
  empty,
}: {
  icon: typeof Bell;
  title: string;
  empty: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4 backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[12px] font-semibold">{title}</span>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/70 px-3 py-4 text-[11.5px] text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
        {empty}
      </div>
    </div>
  );
}
