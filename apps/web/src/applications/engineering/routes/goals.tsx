import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/platform/shell/app-shell";
import {
  PageHeader,
  PageBody,
  Card,
  Progress,
  Button,
  Badge,
  Avatar,
  Skeleton,
} from "@grovyn/ui/primitives";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@grovyn/ui/components/dropdown-menu";
import { api, type Paginated } from "@/shared/lib/api";
import { isAuthenticated, getStoredAuth } from "@/platform/auth/auth";
import { useOrgMembers } from "@/applications/engineering/hooks/use-org-members";
import { avatarColor, userInitials, fullName, fmtDate } from "@grovyn/utils";
import { cn } from "@grovyn/utils";
import { Plus, Archive, Target, X, MoreHorizontal, Check, TrendingUp, Pencil, Users, Lock } from "lucide-react";


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
  visibility: "personal" | "team";
  assignedById?: string | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    jobTitle?: string;
    department?: string;
  };
  assignedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
  } | null;
}

export function GoalsPage() {
  const me = getStoredAuth()?.user;
  const isAdmin = me?.role === "OWNER" || me?.role === "ADMIN";

  const [filter, setFilter] = useState<"active" | "completed" | "archived" | "all">("active");
  const [showCreate, setShowCreate] = useState(false);
  const [formGoalId, setFormGoalId] = useState<string | null>(null); // null = create, else editing
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDue, setNewDue] = useState("");
  const [newVisibility, setNewVisibility] = useState<"personal" | "team">("personal");
  const [newAssignee, setNewAssignee] = useState<string>(""); // "" = myself
  const [editingId, setEditingId] = useState<string | null>(null); // inline progress editor
  const [editProgress, setEditProgress] = useState(0);
  const [editNote, setEditNote] = useState("");
  const queryClient = useQueryClient();

  const { data: membersPage } = useOrgMembers(isAdmin);
  const assignableMembers = membersPage?.data ?? [];

  const resetForm = () => {
    setFormGoalId(null);
    setNewTitle("");
    setNewDesc("");
    setNewDue("");
    setNewVisibility("personal");
    setNewAssignee("");
  };

  const openCreate = () => {
    resetForm();
    setShowCreate(true);
  };

  const openEdit = (g: GoalItem) => {
    setFormGoalId(g.id);
    setNewTitle(g.title);
    setNewDesc(g.description ?? "");
    setNewDue(g.dueDate ? g.dueDate.slice(0, 10) : "");
    setNewVisibility(g.visibility);
    setNewAssignee("");
    setShowCreate(true);
  };

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
    mutationFn: (body: {
      title: string;
      description?: string;
      dueDate?: string;
      visibility: "personal" | "team";
      userId?: string;
    }) => api.post("/goals", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      resetForm();
      setShowCreate(false);
      toast.success("Goal created!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const editMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { title: string; description?: string; dueDate?: string; visibility: "personal" | "team" };
    }) => api.patch(`/goals/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      resetForm();
      setShowCreate(false);
      toast.success("Goal updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (!newTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    if (formGoalId) {
      editMutation.mutate({
        id: formGoalId,
        body: {
          title: newTitle.trim(),
          description: newDesc.trim() || undefined,
          dueDate: newDue || undefined,
          visibility: newVisibility,
        },
      });
    } else {
      createMutation.mutate({
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        dueDate: newDue || undefined,
        visibility: newVisibility,
        userId: isAdmin && newAssignee ? newAssignee : undefined,
      });
    }
  };

  const savingForm = createMutation.isPending || editMutation.isPending;

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
            <Button onClick={openCreate}>
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
              <div className="text-[13.5px] font-semibold">{formGoalId ? "Edit goal" : "New goal"}</div>
              <button
                onClick={() => {
                  setShowCreate(false);
                  resetForm();
                }}
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Visibility
                  </label>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {(["personal", "team"] as const).map((v) => {
                      const selected = newVisibility === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setNewVisibility(v)}
                          className={cn(
                            "flex items-center justify-center gap-1.5 rounded-md border py-1.5 text-[12.5px] font-medium capitalize transition-colors",
                            selected
                              ? "border-foreground/40 bg-accent text-foreground"
                              : "border-border text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {v === "personal" ? (
                            <Lock className="h-3 w-3" />
                          ) : (
                            <Users className="h-3 w-3" />
                          )}
                          {v}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[10.5px] text-muted-foreground">
                    {newVisibility === "personal"
                      ? "Visible to you and admins."
                      : "Visible to the whole org."}
                  </p>
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
              </div>

              {isAdmin && !formGoalId && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Assign to
                  </label>
                  <select
                    value={newAssignee}
                    onChange={(e) => setNewAssignee(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
                  >
                    <option value="">Myself</option>
                    {assignableMembers
                      .filter((m) => m.id !== me?.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {fullName(m.firstName, m.lastName)}
                        </option>
                      ))}
                  </select>
                  <p className="mt-1 text-[10.5px] text-muted-foreground">
                    As an admin you can create this goal for someone else.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowCreate(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={savingForm}>
                  {savingForm ? "Saving…" : formGoalId ? "Save changes" : "Create goal"}
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
            {goals.map((g) => {
              const isOwner = g.userId === me?.id;
              const canOwnerAct = isOwner && g.status === "active";
              const canArchive = (isOwner || isAdmin) && g.status !== "archived";
              const showMenu = canOwnerAct || canArchive;
              return (
              <Card key={g.id} className="p-5 hover:border-foreground/20 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface">
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge tone={g.visibility === "team" ? "info" : "neutral"}>
                      {g.visibility === "team" ? (
                        <Users className="h-3 w-3" />
                      ) : (
                        <Lock className="h-3 w-3" />
                      )}
                      {g.visibility}
                    </Badge>
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
                    {showMenu && (
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
                          {canOwnerAct && (
                            <>
                              <DropdownMenuItem onClick={() => openProgressEditor(g)}>
                                <TrendingUp className="h-3.5 w-3.5" /> Update progress
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => completeMutation.mutate(g.id)}>
                                <Check className="h-3.5 w-3.5" /> Mark complete
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(g)}>
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </DropdownMenuItem>
                            </>
                          )}
                          {canArchive && (
                            <DropdownMenuItem onClick={() => archiveMutation.mutate(g.id)}>
                              <Archive className="h-3.5 w-3.5" /> Archive
                            </DropdownMenuItem>
                          )}
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
                  {canOwnerAct && editingId !== g.id && (
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
                      src={g.user.avatarUrl}
                    />
                    <span className="text-[11.5px] text-muted-foreground">
                      {fullName(g.user.firstName, g.user.lastName)}
                      {g.assignedBy && (
                        <span className="text-muted-foreground/70">
                          {" "}· assigned by {fullName(g.assignedBy.firstName, g.assignedBy.lastName)}
                        </span>
                      )}
                    </span>
                  </div>
                  {g.dueDate && (
                    <span className="text-[11px] text-muted-foreground font-mono-num">
                      Due {fmtDate(g.dueDate)}
                    </span>
                  )}
                </div>
              </Card>
              );
            })}
          </div>
        )}
      </PageBody>
    </AppShell>
  );
}
