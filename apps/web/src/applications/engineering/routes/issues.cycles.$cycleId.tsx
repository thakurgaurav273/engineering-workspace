"use client";
import { usePeople } from "@/applications/engineering/hooks/use-org-members";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
} from "lucide-react";
import { fmtDate } from "@grovyn/utils";
import { AppShell } from "@/platform/shell/app-shell";
import { Badge, Button, Card, EmptyState, PageBody, Skeleton } from "@grovyn/ui/primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@grovyn/ui/components/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@grovyn/ui/components/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@grovyn/ui/components/alert-dialog";
import {
  useCycle,
  useCycleMutations,
  useCycles,
  useIssues,
} from "@/applications/engineering/hooks/use-issues";
import { OPEN_CATEGORIES, cycleLabel, type Cycle } from "@/applications/engineering/lib/issues";
import {
  IssueBoard,
  IssueList,
  type CreateTarget,
  IssuesNav,
  ProgressBar,
  IssueBoardSkeleton,
  IssueListSkeleton,
} from "@/applications/engineering/components/issues/issue-views";
import {
  CreateIssueDialog,
  type CreateIssueDefaults,
} from "@/applications/engineering/components/issues/create-issue-dialog";
import {
  LayoutToggle,
  type IssueLayout,
} from "@/applications/engineering/components/issues/layout-toggle";
import {
  CYCLE_STATE_LABEL,
  CYCLE_STATE_TONE,
  toDateInput,
} from "@/applications/engineering/components/issues/planning-meta";

const REMOVE = "__remove__";

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] outline-none focus:border-foreground/30 [color-scheme:light] dark:[color-scheme:dark]";

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono-num text-[18px] font-semibold">{value}</div>
    </div>
  );
}

function EditCycleDialog({
  open,
  onOpenChange,
  cycle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycle: Cycle;
}) {
  const { update } = useCycleMutations();
  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(cycle.name ?? "");
    setStartsAt(toDateInput(new Date(cycle.startsAt)));
    setEndsAt(toDateInput(new Date(cycle.endsAt)));
  }, [open, cycle]);

  const invalid = !startsAt || !endsAt || endsAt <= startsAt;
  const submit = () => {
    if (invalid || update.isPending) return;
    update.mutate(
      {
        id: cycle.id,
        name: name.trim() || null,
        startsAt: new Date(`${startsAt}T00:00:00`).toISOString(),
        endsAt: new Date(`${endsAt}T00:00:00`).toISOString(),
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit cycle</DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5">
          <label className="block space-y-1.5">
            <span className="text-[11.5px] font-medium text-muted-foreground">Name (optional)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder={`Cycle ${cycle.number}`}
              className={inputClass}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-[11.5px] font-medium text-muted-foreground">Starts</span>
              <input
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11.5px] font-medium text-muted-foreground">Ends</span>
              <input
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={invalid || update.isPending}>
            {update.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function IssueCycleDetailPage({ cycleId }: { cycleId: string }) {
  const { data: cycle, isLoading, isError } = useCycle(cycleId);
  const { data: issuesPage, isLoading: issuesLoading } = useIssues({ cycleId, limit: 500 });
  const { data: teamCycles = [] } = useCycles(cycle?.teamId ?? null);
  const { complete } = useCycleMutations();
  const people = usePeople();
  const [layout, setLayout] = useState<IssueLayout>("list");
  const [editOpen, setEditOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [rollover, setRollover] = useState<string>(REMOVE);
  const [createDefaults, setCreateDefaults] = useState<CreateIssueDefaults | null>(null);

  const rolloverTargets = teamCycles.filter(
    (c) => c.id !== cycleId && (c.state === "current" || c.state === "upcoming"),
  );

  // Default the rollover to the next cycle when there is one.
  useEffect(() => {
    if (!completeOpen) return;
    const next = [...rolloverTargets].sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
    setRollover(next?.id ?? REMOVE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completeOpen]);

  if (isLoading) {
    return (
      <AppShell>
        <PageBody className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
        </PageBody>
      </AppShell>
    );
  }
  if (isError || !cycle) {
    return (
      <AppShell>
        <PageBody>
          <EmptyState
            icon={<RefreshCcw className="h-5 w-5" />}
            title="Cycle not found"
            description="It may have been removed, or the link is wrong."
            action={
              <Link href="/issues/cycles">
                <Button variant="secondary">Back to cycles</Button>
              </Link>
            }
          />
        </PageBody>
      </AppShell>
    );
  }

  const issues = issuesPage?.data ?? [];
  const unfinished = issues.filter((i) => OPEN_CATEGORIES.includes(i.state.category)).length;
  const { progress } = cycle;
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(cycle.endsAt).getTime() - Date.now()) / 86_400_000),
  );
  const completed = !!cycle.completedAt;

  const openCreate = (target: CreateTarget = {}) =>
    setCreateDefaults({ teamId: cycle.teamId, cycleId: completed ? null : cycle.id, ...target });

  return (
    <AppShell>
      <PageBody className="space-y-5">
        <IssuesNav />
        <Link
          href="/issues/cycles"
          className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Cycles
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <RefreshCcw className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-[22px] font-semibold tracking-tight">{cycleLabel(cycle)}</h1>
              <Badge tone={CYCLE_STATE_TONE[cycle.state]}>{CYCLE_STATE_LABEL[cycle.state]}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
              {cycle.team && <span>{cycle.team.name}</span>}
              <span className="inline-flex items-center gap-1.5 font-mono-num">
                <CalendarDays className="h-3.5 w-3.5" />
                {fmtDate(cycle.startsAt)} → {fmtDate(cycle.endsAt)}
              </span>
              {cycle.state === "current" && (
                <span className="font-mono-num">
                  {daysLeft} day{daysLeft === 1 ? "" : "s"} left
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="secondary" disabled={completed} onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            {!completed && (
              <Button variant="secondary" onClick={() => setCompleteOpen(true)}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Complete cycle
              </Button>
            )}
          </div>
        </div>

        <Card className="p-5">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <Stat label="Scope" value={progress.total - progress.canceled} />
            <Stat label="Started" value={progress.started} />
            <Stat label="Done" value={progress.done} />
            <div className="min-w-[200px] flex-1">
              <div className="mb-1.5 text-right font-mono-num text-[12px] text-muted-foreground">
                {Math.round(progress.percent * 100)}%
              </div>
              <ProgressBar done={progress.done} total={progress.total - progress.canceled} />
            </div>
          </div>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[14px] font-semibold">
            Issues <span className="font-mono-num text-muted-foreground">{issues.length}</span>
          </h2>
          <div className="flex items-center gap-2">
            <LayoutToggle value={layout} onChange={setLayout} />
            {!completed && (
              <Button onClick={() => openCreate()}>
                <Plus className="h-3.5 w-3.5" /> New issue
              </Button>
            )}
          </div>
        </div>

        {issuesLoading ? (
          layout === "board" ? (
            <IssueBoardSkeleton />
          ) : (
            <IssueListSkeleton />
          )
        ) : issues.length === 0 ? (
          <EmptyState
            icon={<RefreshCcw className="h-5 w-5" />}
            title="No issues in this cycle"
            description="Add issues here, or set the Cycle property on existing issues of this team."
          />
        ) : layout === "list" ? (
          <IssueList
            issues={issues}
            people={people}
            teamId={cycle.teamId}
            onCreate={completed ? undefined : openCreate}
          />
        ) : (
          <IssueBoard
            issues={issues}
            teamId={cycle.teamId}
            onCreate={completed ? undefined : openCreate}
          />
        )}
      </PageBody>

      <EditCycleDialog open={editOpen} onOpenChange={setEditOpen} cycle={cycle} />

      <AlertDialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete {cycleLabel(cycle)}?</AlertDialogTitle>
            <AlertDialogDescription>
              {unfinished > 0
                ? `${unfinished} unfinished issue${unfinished === 1 ? "" : "s"} will be moved out of this cycle.`
                : "Every issue in this cycle is finished."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {unfinished > 0 && (
            <Select value={rollover} onValueChange={setRollover}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rolloverTargets.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    Move to {cycleLabel(c)} ({fmtDate(c.startsAt)} → {fmtDate(c.endsAt)})
                  </SelectItem>
                ))}
                <SelectItem value={REMOVE}>Remove from cycle</SelectItem>
              </SelectContent>
            </Select>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={complete.isPending}
              onClick={() =>
                complete.mutate({
                  id: cycle.id,
                  rolloverToCycleId: rollover === REMOVE ? undefined : rollover,
                })
              }
            >
              Complete cycle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateIssueDialog
        open={!!createDefaults}
        onOpenChange={(open) => !open && setCreateDefaults(null)}
        defaults={createDefaults ?? undefined}
      />
    </AppShell>
  );
}
