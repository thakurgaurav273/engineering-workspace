"use client";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UrlIntent } from "@/shared/components/url-intent";
import {
  Archive as ArchiveIcon,
  ArchiveRestore,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  SquareKanban,
  Users,
} from "lucide-react";
import { cn } from "@grovyn/utils";
import { AppShell } from "@/platform/shell/app-shell";
import { Badge, Button, EmptyState, PageBody, PageHeader, Skeleton } from "@grovyn/ui/primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@grovyn/ui/components/dropdown-menu";
import { useTeamMutations, useTeams } from "@/applications/engineering/hooks/use-issues";
import type { Team } from "@/applications/engineering/lib/issues";
import {
  CreateTeamDialog,
  MembershipButton,
  TeamIcon,
} from "@/applications/engineering/components/teams/team-ui";
import { teamPageHref } from "@/applications/engineering/lib/team-pages";
import { formatCreated, teamAccess } from "@/applications/engineering/lib/teams";

type View = "all" | "mine" | "archived";

const VIEWS: { key: View; label: string; adminOnly?: boolean }[] = [
  { key: "all", label: "All teams" },
  { key: "mine", label: "Your teams" },
  { key: "archived", label: "Archived", adminOnly: true },
];

// Column widths shared by the header and every row so they line up.
const COL = {
  membership: "w-[96px]",
  members: "w-[76px]",
  issues: "w-[88px]",
  created: "w-[96px]",
  menu: "w-7",
};

function TeamRow({ team, isAdmin }: { team: Team; isAdmin: boolean }) {
  const router = useRouter();
  const { archive } = useTeamMutations();
  const href = `/teams/${team.id}`;
  const archived = !!team.archivedAt;
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget === e.target && router.push(href)}
      className={cn(
        "flex cursor-pointer items-center gap-4 border-b border-border/60 px-4 py-2.5 text-[13px] last:border-b-0 hover:bg-accent/50 focus:bg-accent/50 focus:outline-none",
        archived && "opacity-60",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <TeamIcon team={team} />
        <span className="truncate font-medium text-foreground">{team.name}</span>
        <span className="shrink-0 font-mono-num text-[11.5px] text-muted-foreground">
          {team.key}
        </span>
        {archived && <Badge>Archived</Badge>}
      </div>
      <div className={cn("shrink-0", COL.membership)}>
        <MembershipButton teamId={team.id} myRole={team.myRole} archived={archived} />
      </div>
      <span
        className={cn(
          "hidden shrink-0 items-center gap-1.5 text-muted-foreground sm:inline-flex",
          COL.members,
        )}
        title={`${team.memberCount} member${team.memberCount === 1 ? "" : "s"}`}
      >
        <Users className="h-3.5 w-3.5" />
        <span className="font-mono-num text-[12px]">{team.memberCount}</span>
      </span>
      <Link
        href={teamPageHref("issues", team.id)}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "hidden shrink-0 items-center gap-1.5 text-muted-foreground hover:text-foreground md:inline-flex",
          COL.issues,
        )}
        title="Open issues"
      >
        <SquareKanban className="h-3.5 w-3.5" />
        <span className="font-mono-num text-[12px]">{team.openIssueCount}</span>
      </Link>
      <span
        className={cn(
          "hidden shrink-0 font-mono-num text-[11.5px] text-muted-foreground lg:inline",
          COL.created,
        )}
      >
        {formatCreated(team.createdAt)}
      </span>
      <div className={cn("shrink-0", COL.menu)}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={`${team.name} actions`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          {/* Portalled, but React events still bubble to the row - stop them here. */}
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => router.push(href)}>
              <Settings2 className="h-3.5 w-3.5" /> Team settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`${href}/members`)}>
              <Users className="h-3.5 w-3.5" /> Members
            </DropdownMenuItem>
            {!archived && (
              <DropdownMenuItem onClick={() => router.push(teamPageHref("issues", team.id))}>
                <SquareKanban className="h-3.5 w-3.5" /> View issues
              </DropdownMenuItem>
            )}
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={archive.isPending}
                  onClick={() => archive.mutate({ id: team.id, archived: !archived })}
                >
                  {archived ? (
                    <ArchiveRestore className="h-3.5 w-3.5" />
                  ) : (
                    <ArchiveIcon className="h-3.5 w-3.5" />
                  )}
                  {archived ? "Restore team" : "Archive team"}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/** Workspace → Teams: every team in the organization, Linear-style. */
export function TeamsPage() {
  const router = useRouter();
  const { isAdmin } = teamAccess(null);
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  // Sidebar "+" beside Teams links here with ?new=1.
  const openCreate = useCallback(() => {
    if (isAdmin) setCreateOpen(true);
  }, [isAdmin]);
  const { data: teams, isLoading, isError } = useTeams(view === "archived");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (teams ?? []).filter((t) => {
      if (view === "archived" ? !t.archivedAt : !!t.archivedAt) return false;
      if (view === "mine" && !t.myRole) return false;
      return !q || t.name.toLowerCase().includes(q) || t.key.toLowerCase().includes(q);
    });
  }, [teams, view, query]);

  const noTeamsAtAll = view === "all" && !query && !isLoading && !isError && !teams?.length;

  return (
    <AppShell>
      <UrlIntent param="new" onIntent={openCreate} />
      <PageHeader
        title="Teams"
        description="The groups your organization works in. Every issue belongs to a team, with its own identifier, workflow and cycles. Anyone can join a team."
        actions={
          isAdmin ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New team
            </Button>
          ) : undefined
        }
      />
      <PageBody className="space-y-4">
        {noTeamsAtAll ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="No teams yet"
            description={
              isAdmin
                ? "Create a team (e.g. Engineering, identifier ENG), add its members, then start filing issues."
                : "An admin hasn't created any teams yet."
            }
            action={
              isAdmin ? (
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> New team
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex w-full items-center gap-1 overflow-x-auto rounded-md border border-border bg-surface p-0.5 sm:w-fit">
                {VIEWS.filter((v) => !v.adminOnly || isAdmin).map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => setView(v.key)}
                    aria-pressed={view === v.key}
                    className={cn(
                      "shrink-0 rounded px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                      view === v.key
                        ? "bg-card text-foreground shadow-sm dark:bg-accent"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <label className="flex h-8 w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 text-muted-foreground focus-within:border-foreground/40 sm:w-64">
                <Search className="h-3.5 w-3.5 shrink-0" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter by name or identifier"
                  className="w-full bg-transparent text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground"
                />
              </label>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-11 w-full" />
                ))}
              </div>
            ) : isError ? (
              <EmptyState
                icon={<Users className="h-5 w-5" />}
                title="Couldn't load teams"
                description="Try refreshing the page."
              />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="flex items-center gap-4 border-b border-border bg-surface px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <span className="flex-1">Name</span>
                  <span className={cn("shrink-0", COL.membership)}>Membership</span>
                  <span className={cn("hidden shrink-0 sm:inline", COL.members)}>Members</span>
                  <span className={cn("hidden shrink-0 md:inline", COL.issues)}>Open issues</span>
                  <span className={cn("hidden shrink-0 lg:inline", COL.created)}>Created</span>
                  <span className={cn("shrink-0", COL.menu)} />
                </div>
                {visible.length ? (
                  visible.map((t) => <TeamRow key={t.id} team={t} isAdmin={isAdmin} />)
                ) : (
                  <p className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">
                    {query
                      ? `No teams match "${query.trim()}".`
                      : view === "mine"
                        ? "You haven't joined a team yet - join one from All teams."
                        : view === "archived"
                          ? "No archived teams."
                          : "No teams."}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </PageBody>

      <CreateTeamDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => router.push(`/teams/${id}/members`)}
      />
    </AppShell>
  );
}
