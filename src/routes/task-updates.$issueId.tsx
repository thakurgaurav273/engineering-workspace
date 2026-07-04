import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PageBody, Card, CardHeader, Button, EmptyState, Skeleton, SkeletonListItem, Badge } from "@/components/primitives";
import {
  TaskUpdateTimelineItem,
  taskUpdateStatusLabel,
  type IssueListItem,
  type TaskUpdateItem,
  type TaskUpdateStatus,
} from "@/components/task-updates";
import { api } from "@/lib/api";
import { isAuthenticated, getStoredAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/transforms";
import { ArrowLeft, ExternalLink, ClipboardCheck } from "lucide-react";

export const Route = createFileRoute("/task-updates/$issueId")({ component: IssueDetailPage });

interface IssueDetailResponse {
  issue: IssueListItem;
  updates: TaskUpdateItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const STATUSES: TaskUpdateStatus[] = ["on_track", "at_risk", "blocked", "in_review", "done"];

const statusChipStyles: Record<TaskUpdateStatus, { base: string; selected: string }> = {
  on_track: { base: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", selected: "bg-emerald-600 text-white dark:bg-emerald-500" },
  at_risk: { base: "bg-amber-500/10 text-amber-700 dark:text-amber-400", selected: "bg-amber-600 text-white dark:bg-amber-500" },
  blocked: { base: "bg-rose-500/10 text-rose-700 dark:text-rose-400", selected: "bg-rose-600 text-white dark:bg-rose-500" },
  in_review: { base: "bg-blue-500/10 text-blue-700 dark:text-blue-400", selected: "bg-blue-600 text-white dark:bg-blue-500" },
  done: { base: "bg-violet-500/10 text-violet-700 dark:text-violet-400", selected: "bg-violet-600 text-white dark:bg-violet-500" },
};

function IssueDetailPage() {
  const { issueId } = Route.useParams();
  const auth = getStoredAuth();
  const me = auth?.user;
  const queryClient = useQueryClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<TaskUpdateStatus>("on_track");
  const [trackProgress, setTrackProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timeSpent, setTimeSpent] = useState("");

  const { data, isLoading } = useQuery<IssueDetailResponse>({
    queryKey: ["task-updates", "issues", issueId],
    queryFn: () => api.get(`/task-updates/issues/${issueId}?limit=50`),
    enabled: isAuthenticated() && !!issueId,
  });

  const resetForm = () => {
    setEditingId(null);
    setBody("");
    setStatus("on_track");
    setTrackProgress(false);
    setProgress(0);
    setTimeSpent("");
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["task-updates"] });
  };

  const postMutation = useMutation({
    mutationFn: (dto: { body: string; status: TaskUpdateStatus; progress?: number; timeSpentMinutes?: number }) =>
      api.post(`/task-updates/issues/${issueId}/updates`, dto),
    onSuccess: () => {
      invalidate();
      resetForm();
      toast.success("Update posted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: { body: string; status: TaskUpdateStatus; progress?: number; timeSpentMinutes?: number } }) =>
      api.patch(`/task-updates/updates/${id}`, dto),
    onSuccess: () => {
      invalidate();
      resetForm();
      toast.success("Update saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/task-updates/updates/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success("Update deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const startEdit = (update: TaskUpdateItem) => {
    setEditingId(update.id);
    setBody(update.body);
    setStatus(update.status);
    setTrackProgress(update.progress != null);
    setProgress(update.progress ?? 0);
    setTimeSpent(update.timeSpentMinutes != null ? String(update.timeSpentMinutes) : "");
  };

  const handleSubmit = () => {
    if (!body.trim()) { toast.error("Update text is required"); return; }
    const dto = {
      body: body.trim(),
      status,
      progress: trackProgress ? progress : undefined,
      timeSpentMinutes: timeSpent.trim() ? Number(timeSpent) : undefined,
    };
    if (editingId) editMutation.mutate({ id: editingId, dto });
    else postMutation.mutate(dto);
  };

  if (isLoading) {
    return (
      <AppShell>
        <PageBody className="space-y-4">
          <Skeleton className="h-6 w-64" />
          <SkeletonListItem lines={2} />
          <SkeletonListItem lines={3} />
        </PageBody>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <PageBody>
          <EmptyState icon={<ClipboardCheck className="h-5 w-5" />} title="Issue not found" description="It may have been unassigned or removed from Linear." />
        </PageBody>
      </AppShell>
    );
  }

  const { issue, updates } = data;
  const isAssignee = !!me && issue.assigneeId === me.id;
  const isManagerOfAssignee = !!me && issue.assignee?.managerId === me.id;
  const isAdmin = me?.role === "OWNER" || me?.role === "ADMIN";
  const submitting = postMutation.isPending || editMutation.isPending;

  return (
    <AppShell>
      <div className="border-b border-border px-4 lg:px-8 pt-6 pb-6">
        <Link to="/task-updates" className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Task Updates
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground font-mono-num">
              <span>{issue.identifier}</span>
              <Badge>{issue.stateName}</Badge>
            </div>
            <h1 className="mt-1 text-[20px] font-semibold tracking-tight">{issue.title}</h1>
            {issue.dueDate && <div className="mt-1.5 text-[12px] text-muted-foreground">Due {fmtDate(issue.dueDate)}</div>}
          </div>
          <a href={issue.url} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary">
              <ExternalLink className="h-3.5 w-3.5" /> Open in Linear
            </Button>
          </a>
        </div>
      </div>

      <PageBody className="space-y-5 max-w-3xl">
        {isAssignee && (
          <Card>
            <CardHeader
              title={editingId ? "Edit update" : "Post an update"}
              subtitle="Grovyn-specific progress — Linear stays the source of truth for status, priority, and due dates."
            />
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">What's the state of this issue?</label>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {STATUSES.map((s) => {
                    const selected = status === s;
                    const style = statusChipStyles[s];
                    return (
                      <button
                        key={s}
                        onClick={() => setStatus(s)}
                        className={cn("rounded-md py-1.5 text-[12.5px] font-medium transition-colors", selected ? style.selected : style.base)}
                      >
                        {taskUpdateStatusLabel(s)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Update</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  placeholder="What progress did you make? Anything blocking you?"
                  className="mt-2 w-full rounded-md border border-border bg-background p-3 text-[13px] outline-none focus:border-foreground/40 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <input type="checkbox" checked={trackProgress} onChange={(e) => setTrackProgress(e.target.checked)} />
                    Track % progress
                  </label>
                  {trackProgress && (
                    <div className="mt-2 flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={progress}
                        onChange={(e) => setProgress(Number(e.target.value))}
                        className="flex-1"
                      />
                      <span className="font-mono-num text-[12.5px] font-semibold w-10 text-right">{progress}%</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Time spent <span className="normal-case font-normal">(minutes, optional)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={timeSpent}
                    onChange={(e) => setTimeSpent(e.target.value)}
                    placeholder="e.g. 90"
                    className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                {editingId && (
                  <Button variant="secondary" onClick={resetForm} disabled={submitting}>Cancel</Button>
                )}
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Saving…" : editingId ? "Save changes" : "Post update"}
                </Button>
              </div>
            </div>
          </Card>
        )}

        <div>
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
            Update history {updates.length > 0 && `(${updates.length})`}
          </h2>
          {!updates.length ? (
            <EmptyState
              icon={<ClipboardCheck className="h-5 w-5" />}
              title="No updates yet"
              description={isAssignee ? "Post the first update above." : "The assignee hasn't posted a progress update yet."}
            />
          ) : (
            <div className="space-y-3">
              {updates.map((u) => {
                const isAuthor = u.author.id === me?.id;
                const canDelete = isAuthor || isManagerOfAssignee || isAdmin;
                return (
                  <TaskUpdateTimelineItem
                    key={u.id}
                    update={u}
                    canManage={isAuthor || canDelete}
                    onEdit={isAuthor ? () => startEdit(u) : undefined}
                    onDelete={canDelete ? () => deleteMutation.mutate(u.id) : undefined}
                  />
                );
              })}
            </div>
          )}
        </div>
      </PageBody>
    </AppShell>
  );
}
