import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PageHeader, PageBody, Card, Progress, Button, Badge, Avatar, Skeleton } from "@/components/primitives";
import { api, type Paginated } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { avatarColor, userInitials, fullName, fmtDate } from "@/lib/transforms";
import { Plus, Archive, Target, X } from "lucide-react";

export const Route = createFileRoute("/goals")({ component: GoalsPage });

interface GoalItem {
  id: string; title: string; description?: string | null; progress: number;
  status: "active" | "completed" | "archived"; dueDate?: string | null;
  completedAt?: string | null; archivedAt?: string | null;
  createdAt: string; updatedAt: string; userId: string; orgId: string;
  user: { id: string; firstName: string; lastName: string; avatarUrl?: string; jobTitle?: string; department?: string };
}

function GoalsPage() {
  const [filter, setFilter] = useState<"active" | "completed" | "archived" | "all">("active");
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDue, setNewDue] = useState("");
  const queryClient = useQueryClient();

  const { data: goalsData, isLoading: goalsLoading } = useQuery<Paginated<GoalItem>>({
    queryKey: ['goals', filter],
    queryFn: () => {
      const params = filter === 'all' ? '' : `&status=${filter}`;
      return api.get(`/goals?limit=100${params}`);
    },
    enabled: isAuthenticated(),
  });

  const goals = goalsData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (body: { title: string; description?: string; dueDate?: string }) =>
      api.post('/goals', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setNewTitle("");
      setNewDesc("");
      setNewDue("");
      setShowCreate(false);
      toast.success("Goal created!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCreate = () => {
    if (!newTitle.trim()) { toast.error("Title is required"); return; }
    createMutation.mutate({
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      dueDate: newDue || undefined,
    });
  };

  return (
    <AppShell>
      <PageHeader
        title="Goals"
        description="Personal and team goals across the engineering org."
        actions={<>
          <Button variant="secondary" onClick={() => setFilter("archived")}>
            <Archive className="h-3.5 w-3.5" />Archived
          </Button>
          <Button onClick={() => setShowCreate(true)}><Plus className="h-3.5 w-3.5" />New goal</Button>
        </>}
      />
      <PageBody className="space-y-5">
        {showCreate && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[13.5px] font-semibold">New goal</div>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Title</label>
                <input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="What do you want to achieve?"
                  className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Description <span className="font-normal normal-case text-muted-foreground">(optional)</span>
                </label>
                <textarea
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  rows={2}
                  placeholder="More context on the goal…"
                  className="mt-1.5 w-full rounded-md border border-border bg-background p-3 text-[13px] outline-none focus:border-foreground/40 resize-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Due date <span className="font-normal normal-case text-muted-foreground">(optional)</span>
                </label>
                <input
                  type="date"
                  value={newDue}
                  onChange={e => setNewDue(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating…" : "Create goal"}
                </Button>
              </div>
            </div>
          </Card>
        )}

        <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5 w-fit">
          {(["active", "completed", "archived", "all"] as const).map(f => (
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
            No {filter === 'all' ? '' : filter} goals yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {goals.map(g => (
              <Card key={g.id} className="p-5 hover:border-foreground/20 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface">
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Badge tone={g.status === "completed" ? "success" : g.status === "archived" ? "neutral" : "info"}>
                    {g.status}
                  </Badge>
                </div>
                <div className="mt-4 text-[14px] font-semibold leading-snug">{g.title}</div>
                {g.description && (
                  <p className="mt-1.5 text-[12.5px] text-muted-foreground line-clamp-2">{g.description}</p>
                )}
                <div className="mt-5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Progress</span>
                    <span className="font-mono-num text-[13px] font-semibold">{g.progress}%</span>
                  </div>
                  <Progress value={g.progress} />
                </div>
                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar initials={userInitials(g.user.firstName, g.user.lastName)} color={avatarColor(g.user.id)} size="xs" />
                    <span className="text-[11.5px] text-muted-foreground">{fullName(g.user.firstName, g.user.lastName)}</span>
                  </div>
                  {g.dueDate && (
                    <span className="text-[11px] text-muted-foreground font-mono-num">Due {fmtDate(g.dueDate)}</span>
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
