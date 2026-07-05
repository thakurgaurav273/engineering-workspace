import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import {
  PageHeader,
  PageBody,
  Card,
  Progress,
  Button,
  Badge,
  Avatar,
  Skeleton,
} from "@/components/primitives";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { api, type Paginated } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { avatarColor, userInitials, fullName, fmtDate } from "@/lib/transforms";
import { Plus, Archive, Target, X, MoreHorizontal, Check, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/goals")({ component: GoalsPage });

interface GoalItem {
  id: string;
  title: string;
  description?: string | null;
  progress: number;
  status: "active" | "completed" | "archived";
  dueDate?: string | null;
  completedAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  orgId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    jobTitle?: string;
    department?: string;
  };
}

function GoalsPage() {
  const [filter, setFilter] = useState<"active" | "completed" | "archived" | "all">("active");
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDue, setNewDue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProgress, setEditProgress] = useState(0);
  const [editNote, setEditNote] = useState("");
  const queryClient = useQueryClient();

  const invalidateGoals = () => {
    queryClient.invalidateQueries({ queryKey: ["goals"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const { data: goalsData, isLoading: goalsLoading } = useQuery<Paginated<GoalItem>>({
    queryKey: ["goals", filter],
    queryFn: () => {
      const params = filter === "all" ? "" : `&status=${filter}`;
      return api.get(`/goals?limit=100${params}`);
    },
    enabled: isAuthenticated(),
  });

  const goals = goalsData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (body: { title: string; description?: string; dueDate?: string }) =>
      api.post("/goals", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setNewTitle("");
      setNewDesc("");
      setNewDue("");
      setShowCreate(false);
      toast.success("Goal created!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCreate = () => {
    if (!newTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    createMutation.mutate({
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      dueDate: newDue || undefined,
    });
  };

  const progressMutation = useMutation({
    mutationFn: ({ id, progress, note }: { id: string; progress: number; note?: string }) =>
      api.patch(`/goals/${id}/progress`, { progress, ...(note ? { note } : {}) }),
    onSuccess: () => {
      invalidateGoals();
      setEditingId(null);
      toast.success("Progress updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/goals/${id}/complete`),
    onSuccess: () => {
      invalidateGoals();
      toast.success("Goal marked complete 🎉");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/goals/${id}/archive`),
    onSuccess: () => {
      invalidateGoals();
      toast.success("Goal archived");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openProgressEditor = (g: GoalItem) => {
    setEditingId(g.id);
    setEditProgress(g.progress);
    setEditNote("");
  };

  const saveProgress = (id: string) => {
    progressMutation.mutate({
      id,
      progress: Math.round(editProgress),
      note: editNote.trim() || undefined,
    });
  };

  return (
    <AppShell>
      <PageHeader
        title="Goals"
        description="Personal and team goals across the engineering org."
        actions={
          <>
            <Button variant="secondary" onClick={() => setFilter("archived")}>
              <Archive className="h-3.5 w-3.5" />
              Archived
            </Button>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5" />
              New goal
            </Button>
          </>
        }
      />
      <PageBody className="space-y-5">
        {showCreate && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[13.5px] font-semibold">New goal</div>
              <button
                onClick={() => setShowCreate(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Title
                </label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="What do you want to achieve?"
                  className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Description{" "}
                  <span className="font-normal normal-case text-muted-foreground">(optional)</span>
                </label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={2}
                  placeholder="More context on the goal…"
                  className="mt-1.5 w-full rounded-md border border-border bg-background p-3 text-[13px] outline-none focus:border-foreground/40 resize-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Due date{" "}
                  <span className="font-normal normal-case text-muted-foreground">(optional)</span>
                </label>
                <input
                  type="date"
                  value={newDue}
                  onChange={(e) => setNewDue(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating…" : "Create goal"}
                </Button>
              </div>
            </div>
          </Card>
        )}

        <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5 w-fit">
          {(["active", "completed", "archived", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-[12.5px] capitalize transition-colors ${filter === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {f}
            </button>
          ))}
        </div>

        {goalsLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <Skeleton className="h-9 w-9 rounded-md" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-1.5 w-full rounded-full" />
              </Card>
            ))}
          </div>
        ) : !goals.length ? (
          <div className="rounded-lg border border-dashed border-border py-16 text-center text-[12.5px] text-muted-foreground">
            No {filter === "all" ? "" : filter} goals yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {goals.map((g) => (
              <Card key={g.id} className="p-5 hover:border-foreground/20 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface">
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      tone={
                        g.status === "completed"
                          ? "success"
                          : g.status === "archived"
                            ? "neutral"
                            : "info"
                      }
                    >
                      {g.status}
                    </Badge>
                    {g.status !== "archived" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                            aria-label="Goal actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {g.status === "active" && (
                            <>
                              <DropdownMenuItem onClick={() => openProgressEditor(g)}>
                                <TrendingUp className="h-3.5 w-3.5" /> Update progress
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => completeMutation.mutate(g.id)}>
                                <Check className="h-3.5 w-3.5" /> Mark complete
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem onClick={() => archiveMutation.mutate(g.id)}>
                            <Archive className="h-3.5 w-3.5" /> Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
                <div className="mt-4 text-[14px] font-semibold leading-snug">{g.title}</div>
                {g.description && (
                  <p className="mt-1.5 text-[12.5px] text-muted-foreground line-clamp-2">
                    {g.description}
                  </p>
                )}
                <div className="mt-5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Progress
                    </span>
                    <span className="font-mono-num text-[13px] font-semibold">{g.progress}%</span>
                  </div>
                  <Progress value={g.progress} />
                  {g.status === "active" && editingId !== g.id && (
                    <button
                      onClick={() => openProgressEditor(g)}
                      className="mt-2 text-[11.5px] font-medium text-muted-foreground hover:text-foreground"
                    >
                      Update progress
                    </button>
                  )}
                  {editingId === g.id && (
                    <div className="mt-3 space-y-2.5 rounded-md border border-border bg-surface p-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={editProgress}
                          onChange={(e) => setEditProgress(Number(e.target.value))}
                          className="flex-1 accent-foreground"
                        />
                        <span className="font-mono-num text-[13px] font-semibold w-10 text-right">
                          {editProgress}%
                        </span>
                      </div>
                      <textarea
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        rows={2}
                        placeholder="Add a note about this update… (optional)"
                        className="w-full rounded-md border border-border bg-background p-2.5 text-[12.5px] outline-none focus:border-foreground/40 resize-none"
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => saveProgress(g.id)}
                          disabled={progressMutation.isPending}
                        >
                          {progressMutation.isPending ? "Saving…" : "Save progress"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar
                      initials={userInitials(g.user.firstName, g.user.lastName)}
                      color={avatarColor(g.user.id)}
                      size="xs"
                    />
                    <span className="text-[11.5px] text-muted-foreground">
                      {fullName(g.user.firstName, g.user.lastName)}
                    </span>
                  </div>
                  {g.dueDate && (
                    <span className="text-[11px] text-muted-foreground font-mono-num">
                      Due {fmtDate(g.dueDate)}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </PageBody>
    </AppShell>
  );
}
