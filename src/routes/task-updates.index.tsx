import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PageHeader, PageBody, Card, Button, EmptyState, Skeleton } from "@/components/primitives";
import { IssueCard, workflowStateLabel, type IssueListItem, type LinearWorkflowType } from "@/components/task-updates";
import { api, type Paginated } from "@/lib/api";
import { isAuthenticated, getStoredAuth } from "@/lib/auth";
import { relativeTime } from "@/lib/transforms";
import { Search, ExternalLink, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/task-updates/")({ component: TaskUpdatesPage });

const STATES: LinearWorkflowType[] = ["backlog", "unstarted", "started", "completed", "canceled"];

interface SyncStatus {
  linearConnected: boolean;
  workspaceName: string | null;
  lastSyncedAt: string | null;
  issueCount: number;
}

function TaskUpdatesPage() {
  const [q, setQ] = useState("");
  const [state, setState] = useState<LinearWorkflowType | "all">("all");
  const auth = getStoredAuth();
  const me = auth?.user;
  const canSync = me?.role === "OWNER" || me?.role === "ADMIN";
  const queryClient = useQueryClient();

  const { data: syncStatus, isLoading: syncLoading } = useQuery<SyncStatus>({
    queryKey: ["task-updates", "sync-status"],
    queryFn: () => api.get("/task-updates/sync/status"),
    enabled: isAuthenticated(),
  });

  const { data, isLoading } = useQuery<Paginated<IssueListItem>>({
    queryKey: ["task-updates", "issues", state, q],
    queryFn: () =>
      api.get(
        `/task-updates/issues?limit=50${state !== "all" ? `&state=${state}` : ""}${q ? `&search=${encodeURIComponent(q)}` : ""}`,
      ),
    enabled: isAuthenticated() && !!syncStatus?.linearConnected,
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post("/task-updates/sync"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-updates"] });
      toast.success("Sync started — issues will refresh shortly");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const issues = data?.data ?? [];

  return (
    <AppShell>
      <PageHeader
        title="Task Updates"
        description="Post progress on the Linear issues assigned to you. Linear stays the source of truth for status, priority, and due dates."
        actions={
          canSync && syncStatus?.linearConnected ? (
            <Button variant="secondary" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              {syncMutation.isPending ? "Syncing…" : "Sync now"}
            </Button>
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
              </div>
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
                description={q || state !== "all" ? "Try a different search or filter." : "Nothing is assigned to you in Linear right now."}
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {issues.map((issue) => (
                  <IssueCard key={issue.id} issue={issue} />
                ))}
              </div>
            )}
          </>
        )}
      </PageBody>
    </AppShell>
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
