import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PageHeader, PageBody, Card, Button, EmptyState, Skeleton, Avatar } from "@/components/primitives";
import { IssueCard, workflowStateLabel, type IssueListItem, type LinearWorkflowType } from "@/components/task-updates";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { api, type Paginated } from "@/lib/api";
import { isAuthenticated, getStoredAuth } from "@/lib/auth";
import { relativeTime, avatarColor, userInitials, fullName } from "@/lib/transforms";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Search, ExternalLink, RefreshCw, Users, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/task-updates/")({ component: TaskUpdatesPage });

const STATES: LinearWorkflowType[] = ["backlog", "unstarted", "started", "completed", "canceled"];

// Mirrored exactly in backend/src/engineering/task-updates/task-updates.service.ts -
// sentinels sent inside the comma-separated userIds param instead of real membership IDs.
const ALL_SENTINEL = "__all__";
const UNASSIGNED_SENTINEL = "__unassigned__";

interface SyncStatus {
  linearConnected: boolean;
  workspaceName: string | null;
  lastSyncedAt: string | null;
  issueCount: number;
  unassignedCount: number;
}

interface SyncResult {
  skipped: boolean;
  synced: number;
  archived: number;
}

interface OrgMember {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

function userFilterKey(adminId: string) {
  return `grovyn_task_updates_user_filter_${adminId}`;
}

function TaskUpdatesPage() {
  const [q, setQ] = useState("");
  const [state, setState] = useState<LinearWorkflowType | "all">("all");
  const [confirmSyncOpen, setConfirmSyncOpen] = useState(false);
  const auth = getStoredAuth();
  const me = auth?.user;
  const canSync = me?.role === "OWNER" || me?.role === "ADMIN";
  const isAdmin = me?.role === "OWNER" || me?.role === "ADMIN";
  const queryClient = useQueryClient();

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(() => {
    if (!isAdmin || !me || typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(userFilterKey(me.id)) ?? "[]");
    } catch {
      return [];
    }
  });

  const updateSelectedUserIds = (ids: string[]) => {
    setSelectedUserIds(ids);
    if (me) localStorage.setItem(userFilterKey(me.id), JSON.stringify(ids));
  };

  const { data: syncStatus, isLoading: syncLoading } = useQuery<SyncStatus>({
    queryKey: ["task-updates", "sync-status"],
    queryFn: () => api.get("/task-updates/sync/status"),
    enabled: isAuthenticated(),
  });

  const { data: members } = useQuery<Paginated<OrgMember>>({
    queryKey: ["people", "for-task-updates-filter"],
    queryFn: () => api.get("/people?limit=100"),
    enabled: isAuthenticated() && isAdmin,
  });

  const debouncedQ = useDebouncedValue(q, 300);
  const [page, setPage] = useState(1);

  // Any filter change invalidates whatever page you were on - e.g. page 2 of an
  // unfiltered list is meaningless once a search narrows the result set.
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, state, selectedUserIds]);

  const { data, isLoading, isFetching } = useQuery<Paginated<IssueListItem>>({
    queryKey: ["task-updates", "issues", state, debouncedQ, selectedUserIds, page],
    queryFn: () =>
      api.get(
        `/task-updates/issues?page=${page}&limit=50${state !== "all" ? `&state=${state}` : ""}${debouncedQ.trim() ? `&search=${encodeURIComponent(debouncedQ.trim())}` : ""}${selectedUserIds.length ? `&userIds=${selectedUserIds.join(",")}` : ""}`,
      ),
    enabled: isAuthenticated() && !!syncStatus?.linearConnected,
    placeholderData: keepPreviousData,
  });

  const isSearching = q !== debouncedQ || isFetching;

  const syncMutation = useMutation({
    mutationFn: () => api.post<SyncResult>("/task-updates/sync"),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["task-updates"] });
      if (result.skipped) {
        toast.warning("Sync didn't run - check that Linear is still connected in Settings.");
      } else {
        toast.success(`Synced ${result.synced} issue${result.synced === 1 ? "" : "s"}${result.archived ? `, archived ${result.archived}` : ""}.`);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const issues = data?.data ?? [];
  const orgMembers = members?.data ?? [];

  return (
    <AppShell>
      <PageHeader
        title="Task Updates"
        description="Post progress on the Linear issues assigned to you. Linear stays the source of truth for status, priority, and due dates."
        actions={
          canSync && syncStatus?.linearConnected ? (
            <>
              <Button variant="secondary" onClick={() => setConfirmSyncOpen(true)} disabled={syncMutation.isPending}>
                <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                {syncMutation.isPending ? "Syncing…" : "Sync now"}
              </Button>
              <AlertDialog open={confirmSyncOpen} onOpenChange={setConfirmSyncOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sync with Linear now?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This pulls the latest issues and assignees for the whole org directly from Linear. It can take a few
                      seconds, and manual syncs are limited to a few per minute.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => syncMutation.mutate()}>Sync now</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : undefined
        }
      />
      <PageBody className="space-y-5">
        {syncLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => <IssueCardSkeleton key={i} />)}
          </div>
        ) : !syncStatus?.linearConnected ? (
          <EmptyState
            icon={<ExternalLink className="h-5 w-5" />}
            title="Linear isn't connected"
            description="Connect a Linear API key in Settings → Integrations to start pulling in assigned issues."
            action={
              <Link to="/settings">
                <Button variant="secondary">Go to Settings</Button>
              </Link>
            }
          />
        ) : (
          <>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 flex-1">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by identifier or title"
                  className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
                />
                {isSearching && <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />}
              </div>
              {isAdmin && (
                <UserFilterPopover
                  members={orgMembers}
                  selected={selectedUserIds}
                  onChange={updateSelectedUserIds}
                  unassignedCount={syncStatus?.unassignedCount ?? 0}
                />
              )}
              <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5 flex-wrap">
                <button
                  onClick={() => setState("all")}
                  className={`px-2 py-1 rounded text-[12px] transition-colors ${state === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  All
                </button>
                {STATES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setState(s)}
                    className={`px-2 py-1 rounded text-[12px] transition-colors ${state === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {workflowStateLabel(s)}
                  </button>
                ))}
              </div>
            </div>

            {syncStatus.lastSyncedAt && (
              <div className="text-[11.5px] text-muted-foreground">
                Last synced {relativeTime(syncStatus.lastSyncedAt)} · {syncStatus.issueCount} issue{syncStatus.issueCount === 1 ? "" : "s"} tracked
                {isAdmin && syncStatus.unassignedCount > 0 && (
                  <>
                    {" · "}
                    <button
                      onClick={() => updateSelectedUserIds([UNASSIGNED_SENTINEL])}
                      className="underline decoration-dotted hover:text-foreground"
                    >
                      {syncStatus.unassignedCount} unassigned in Linear
                    </button>
                    {" (assignee email doesn't match anyone in this org)"}
                  </>
                )}
              </div>
            )}

            {isLoading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {Array.from({ length: 6 }).map((_, i) => <IssueCardSkeleton key={i} />)}
              </div>
            ) : !issues.length ? (
              <EmptyState
                icon={<Search className="h-5 w-5" />}
                title="No issues found"
                description={
                  q || state !== "all" || selectedUserIds.length
                    ? "Try a different search or filter."
                    : "Nothing is assigned to you in Linear right now."
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {issues.map((issue) => (
                  <IssueCard key={issue.id} issue={issue} />
                ))}
              </div>
            )}

            {!!data && data.totalPages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11.5px] text-muted-foreground">
                  Showing {(data.page - 1) * data.limit + 1}-{Math.min(data.page * data.limit, data.total)} of {data.total}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || isFetching}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Prev
                  </Button>
                  <span className="text-[11.5px] text-muted-foreground px-1">
                    Page {data.page} of {data.totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                    disabled={page >= data.totalPages || isFetching}
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </PageBody>
    </AppShell>
  );
}

function UserFilterPopover({
  members, selected, onChange, unassignedCount,
}: { members: OrgMember[]; selected: string[]; onChange: (ids: string[]) => void; unassignedCount: number }) {
  const viewingAll = selected.includes(ALL_SENTINEL);

  // Selecting/deselecting a specific person or "Unassigned" always drops out of the
  // "everyone" sentinel first, so it starts building an explicit list instead of trying
  // to combine "all" with a single exclusion.
  const toggle = (id: string) => {
    const base = viewingAll ? [] : selected;
    onChange(base.includes(id) ? base.filter((x) => x !== id) : [...base, id]);
  };

  const label = viewingAll ? "Viewing: everyone" : selected.length ? `Viewing (${selected.length})` : "Viewing: me";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary">
          <Users className="h-3.5 w-3.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Show issues for</div>
          <button
            onClick={() => onChange(viewingAll ? [] : [ALL_SENTINEL])}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            {viewingAll ? "Clear" : "Everyone"}
          </button>
        </div>
        {viewingAll && (
          <div className="mb-2 text-[11.5px] text-muted-foreground">
            Showing everyone's issues. Clear "Everyone" to pick specific people.
          </div>
        )}
        <div className={`max-h-64 space-y-1 overflow-y-auto ${viewingAll ? "pointer-events-none opacity-50" : ""}`}>
          {unassignedCount > 0 && (
            <label className="flex items-center gap-2 rounded px-1 py-1 text-[12.5px] cursor-pointer hover:bg-surface">
              <Checkbox
                checked={selected.includes(UNASSIGNED_SENTINEL)}
                onCheckedChange={() => toggle(UNASSIGNED_SENTINEL)}
              />
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-[9px] text-muted-foreground">?</span>
              Unassigned ({unassignedCount})
            </label>
          )}
          {members.map((m) => (
            <label key={m.id} className="flex items-center gap-2 rounded px-1 py-1 text-[12.5px] cursor-pointer hover:bg-surface">
              <Checkbox checked={selected.includes(m.id)} onCheckedChange={() => toggle(m.id)} />
              <Avatar initials={userInitials(m.firstName, m.lastName)} color={avatarColor(m.id)} size="xs" src={m.avatarUrl} />
              {fullName(m.firstName, m.lastName)}
            </label>
          ))}
        </div>
        {selected.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="mt-3 text-[11.5px] text-muted-foreground hover:text-foreground"
          >
            Reset to my issues
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function IssueCardSkeleton() {
  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-1.5 w-full rounded-full" />
    </Card>
  );
}
