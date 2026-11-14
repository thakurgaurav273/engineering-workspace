"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Settings2 } from "lucide-react";
import { cn } from "@grovyn/utils";
import { useTeams } from "@/applications/engineering/hooks/use-issues";
import { TeamIcon } from "@/applications/engineering/components/teams/team-ui";
import { TEAM_PAGES, teamPageHref } from "@/applications/engineering/lib/team-pages";
import type { SidebarSectionProps } from "@/platform/registry/app-sidebar-sections";

/** Teams the person folded away, remembered per browser. */
const COLLAPSED_KEY = "grovyn_sidebar_collapsed_teams";

function readCollapsed(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]");
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

const rowClass = (active: boolean) =>
  cn(
    "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors",
    active
      ? "bg-accent text-foreground font-medium"
      : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
  );

/**
 * Linear-style "Your teams": every team you're on, each opening into its Issues, Cycles and
 * Projects. Joining or leaving a team updates it straight away (the teams query refreshes).
 */
export function TeamsSidebarSection({ pathname, search, onNavigate }: SidebarSectionProps) {
  const { data: teams, isLoading } = useTeams();
  const mine = (teams ?? []).filter((t) => t.myRole);
  // Read after mount so the server render and the first client render agree.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  useEffect(() => setCollapsed(readCollapsed()), []);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
      } catch {
        /* storage unavailable - the choice just won't stick */
      }
      return next;
    });

  if (isLoading) return null;
  const currentTeam = search?.get("team") ?? null;

  return (
    <div>
      <div className="px-2 mb-1.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
        Your teams
      </div>
      {mine.length === 0 ? (
        <p className="px-2 text-[12px] leading-relaxed text-muted-foreground">
          You&apos;re not on a team yet.{" "}
          <Link
            href="/teams"
            onClick={onNavigate}
            className="text-foreground underline underline-offset-2"
          >
            Browse teams
          </Link>
        </p>
      ) : (
        <ul className="space-y-0.5">
          {mine.map((team) => {
            const open = !collapsed.has(team.id);
            const activeKey =
              currentTeam === team.id
                ? TEAM_PAGES.find((p) => pathname === p.path)?.key
                : undefined;
            return (
              <li key={team.id}>
                <div className="group flex items-center rounded-md hover:bg-accent/60">
                  <button
                    type="button"
                    onClick={() => toggle(team.id)}
                    aria-expanded={open}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5 text-left text-[13px] transition-colors",
                      // Folded away with one of its pages open: mark the team itself.
                      !open && activeKey
                        ? "font-medium text-foreground"
                        : "text-muted-foreground group-hover:text-foreground",
                    )}
                  >
                    <TeamIcon team={team} size="xs" />
                    <span className="truncate">{team.name}</span>
                    <ChevronRight
                      className={cn(
                        "h-3 w-3 shrink-0 opacity-60 transition-transform",
                        open && "rotate-90",
                      )}
                    />
                  </button>
                  <Link
                    href={`/teams/${team.id}`}
                    onClick={onNavigate}
                    aria-label={`${team.name} settings`}
                    title="Team settings"
                    className="mr-1 grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                  </Link>
                </div>
                {open && (
                  <ul className="mt-0.5 ml-[17px] space-y-0.5 border-l border-border pl-2">
                    {TEAM_PAGES.map((page) => {
                      const active = activeKey === page.key;
                      const Icon = page.icon;
                      return (
                        <li key={page.key}>
                          <Link
                            href={teamPageHref(page.key, team.id)}
                            onClick={onNavigate}
                            aria-current={active ? "page" : undefined}
                            className={rowClass(active)}
                          >
                            <Icon
                              className={cn(
                                "h-4 w-4 shrink-0",
                                active ? "text-foreground" : "text-muted-foreground",
                              )}
                            />
                            <span className="truncate">{page.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
