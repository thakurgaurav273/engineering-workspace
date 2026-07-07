import Link from "next/link";
import { ArrowRight, Star, Clock } from "lucide-react";
import {
  iconFor,
  ApplicationStatus,
  type ApplicationManifest,
} from "@/platform/registry/app-registry";
import { relativeTime } from "@/platform/shell/launcher-prefs";

interface BadgeSpec {
  label: string;
  cls: string;
}

// Registry status -> a human badge. Only these four are ever shown to a user (DISABLED apps
// are filtered out server-side before they reach the launcher).
const STATUS_BADGE: Partial<Record<ApplicationStatus, BadgeSpec>> = {
  [ApplicationStatus.ACTIVE]: {
    label: "Stable",
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  [ApplicationStatus.EXPERIMENTAL]: {
    label: "Experimental",
    cls: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  [ApplicationStatus.MAINTENANCE]: {
    label: "Maintenance",
    cls: "border-border bg-surface text-muted-foreground",
  },
  [ApplicationStatus.COMING_SOON]: {
    label: "Coming soon",
    cls: "border-border bg-surface text-muted-foreground",
  },
};

function permissionSummary(app: ApplicationManifest): string {
  if (app.requiresSuperAdmin) return "Admin only";
  const n = app.permissions.length;
  if (n === 0) return "Standard access";
  return `${n} permission${n === 1 ? "" : "s"}`;
}

export function ApplicationCard({
  app,
  favourite,
  lastOpened,
  onToggleFavourite,
  onLaunch,
}: {
  app: ApplicationManifest;
  favourite: boolean;
  lastOpened?: string | null;
  onToggleFavourite: (key: string) => void;
  onLaunch: (app: ApplicationManifest) => void;
}) {
  const Icon = iconFor(app.icon);
  const badge = STATUS_BADGE[app.status];
  const comingSoon = app.status === ApplicationStatus.COMING_SOON;
  const opened = relativeTime(lastOpened);

  const body = (
    <>
      {/* soft gradient wash that intensifies on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-foreground/[0.03] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
      <div className="relative flex items-start justify-between gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-accent to-surface text-foreground ring-1 ring-border/60 transition-transform duration-300 group-hover:scale-[1.04]">
          <Icon className="h-6 w-6" />
        </span>
        <button
          type="button"
          aria-label={favourite ? "Unpin" : "Pin to top"}
          aria-pressed={favourite}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavourite(app.key);
          }}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Star className={`h-4 w-4 ${favourite ? "fill-amber-400 text-amber-400" : ""}`} />
        </button>
      </div>

      <div className="relative mt-4 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-[15px] font-semibold tracking-tight">{app.name}</h3>
          {badge ? (
            <span
              className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide ${badge.cls}`}
            >
              {badge.label}
            </span>
          ) : null}
        </div>
        {app.description ? (
          <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
            {app.description}
          </p>
        ) : null}
      </div>

      <div className="relative mt-4 flex items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="rounded-md bg-surface px-1.5 py-0.5 font-mono-num">v{app.version}</span>
        <span className="truncate">{permissionSummary(app)}</span>
      </div>

      <div className="relative mt-3 flex items-center justify-between border-t border-border/60 pt-3">
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {opened ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/70" />
              <Clock className="h-3 w-3" /> {opened}
            </>
          ) : (
            <span className="text-muted-foreground/70">Not opened yet</span>
          )}
        </span>
        {!comingSoon ? (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-foreground/80 transition-colors group-hover:text-foreground">
            Launch
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        ) : null}
      </div>
    </>
  );

  const base =
    "group relative flex min-h-[188px] flex-col rounded-2xl border border-border bg-card/60 p-5 shadow-sm backdrop-blur-sm transition-all duration-300";

  if (comingSoon) {
    return (
      <div className={`${base} cursor-not-allowed opacity-55`} aria-disabled="true">
        {body}
      </div>
    );
  }

  return (
    <Link
      href={app.routePrefix}
      onClick={() => onLaunch(app)}
      className={`${base} hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg hover:shadow-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
    >
      {body}
    </Link>
  );
}
