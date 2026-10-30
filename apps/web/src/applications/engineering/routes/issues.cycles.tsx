"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RefreshCcw } from "lucide-react";
import { fmtDate } from "@grovyn/utils";
import { AppShell } from "@/platform/shell/app-shell";
import { Badge, Button, EmptyState, PageBody, PageHeader, Skeleton } from "@grovyn/ui/primitives";
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
  useCycleMutations,
  useCycles,
  useTeams,
} from "@/applications/engineering/hooks/use-issues";
import { cycleLabel, type Cycle } from "@/applications/engineering/lib/issues";
import {
  CYCLE_STATE_LABEL,
  CYCLE_STATE_TONE,
  addDays,
  toDateInput,
} from "@/applications/engineering/components/issues/planning-meta";
import { IssuesNav, ProgressBar } from "@/applications/engineering/components/issues/issue-views";

const TEAM_KEY = "grovyn_issues_cycles_team";

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] outline-none focus:border-foreground/30 [color-scheme:light] dark:[color-scheme:dark]";

function readStoredTeam(): string | null {
  try {
    return localStorage.getItem(TEAM_KEY);
  } catch {
    return null;
  }
}

function CycleRow({ cycle }: { cycle: Cycle }) {
  const router = useRouter();
  const scope = cycle.progress.total - cycle.progress.canceled;
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/issues/cycles/${cycle.id}`)}
      onKeyDown={(e) => e.key === "Enter" && router.push(`/issues/cycles/${cycle.id}`)}
      className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/60 px-4 py-3 text-[13px] last:border-b-0 hover:bg-accent/50 focus:bg-accent/50 focus:outline-none"
    >
      <div className="flex min-w-0 flex-1 basis-[200px] items-center gap-2.5">
        <RefreshCcw className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{cycleLabel(cycle)}</span>
        {cycle.name && (
          <span className="font-mono-num text-[11.5px] text-muted-foreground">#{cycle.number}</span>
        )}
      </div>
      <span className="font-mono-num text-[12px] text-muted-foreground">
        {fmtDate(cycle.startsAt)} → {fmtDate(cycle.endsAt)}
      </span>
      <Badge tone={CYCLE_STATE_TONE[cycle.state]} className="shrink-0">
        {CYCLE_STATE_LABEL[cycle.state]}
      </Badge>
      <div className="flex w-full items-center gap-3 sm:w-[200px] sm:shrink-0">
        <ProgressBar done={cycle.progress.done} total={scope} className="flex-1" />
        <span className="w-9 text-right font-mono-num text-[11.5px] text-muted-foreground">
          {Math.round(cycle.progress.percent * 100)}%
        </span>
      </div>
    </div>
  );
}

function CycleSection({ title, cycles }: { title: string; cycles: Cycle[] }) {
  if (!cycles.length) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {cycles.map((c) => (
          <CycleRow key={c.id} cycle={c} />
        ))}
      </div>
    </section>
  );
}

function NewCycleDialog({
  open,
  onOpenChange,
  teamId,
  cycles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  cycles: Cycle[];
}) {
  const { create } = useCycleMutations();
  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  useEffect(() => {
    if (!open) return;
    // Pick up where the latest cycle leaves off, so cycles run back to back.
    const latestEnd = cycles.reduce<Date | null>((max, c) => {
      const end = new Date(c.endsAt);
      return !max || end > max ? end : max;
    }, null);
    const start = latestEnd && latestEnd > new Date() ? latestEnd : new Date();
    setName("");
    setStartsAt(toDateInput(start));
    setEndsAt(toDateInput(addDays(start, 14)));
  }, [open, cycles]);

  const invalid = !startsAt || !endsAt || endsAt <= startsAt;

  const submit = () => {
    if (invalid || create.isPending) return;
    create.mutate(
      {
        teamId,
        name: name.trim() || undefined,
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
          <DialogTitle>New cycle</DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5">
          <label className="block space-y-1.5">
            <span className="text-[11.5px] font-medium text-muted-foreground">Name (optional)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="e.g. Sprint 14 - defaults to Cycle N"
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
          {startsAt && endsAt && endsAt <= startsAt && (
            <p className="text-[12px] text-rose-600 dark:text-rose-400">
              The cycle must end after it starts.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={invalid || create.isPending}>
            {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create cycle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function IssueCyclesPage() {
  const { data: teams, isLoading: teamsLoading } = useTeams();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Default: last viewed team, else a team I'm on, else the first team.
  useEffect(() => {
    if (teamId || !teams?.length) return;
    const stored = readStoredTeam();
    const pick =
      teams.find((t) => t.id === stored) ?? teams.find((t) => t.myRole != null) ?? teams[0];
    setTeamId(pick.id);
  }, [teams, teamId]);

  const chooseTeam = (id: string) => {
    setTeamId(id);
    try {
      localStorage.setItem(TEAM_KEY, id);
    } catch {
      /* storage unavailable */
    }
  };

  const { data: cycles, isLoading: cyclesLoading, isError } = useCycles(teamId);
  const grouped = useMemo(() => {
    const all = cycles ?? [];
    return {
      current: all.filter((c) => c.state === "current"),
      // Soonest first; the API returns newest first.
      upcoming: all.filter((c) => c.state === "upcoming").reverse(),
      past: all.filter((c) => c.state === "past" || c.state === "completed"),
    };
  }, [cycles]);

  const loading = teamsLoading || (!!teamId && cyclesLoading);

  return (
    <AppShell>
      <PageHeader
        title="Cycles"
        description="Time-boxed iterations per team. Unfinished issues can roll over into the next cycle when one is completed."
        actions={
          teamId ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New cycle
            </Button>
          ) : undefined
        }
      />
      <PageBody className="space-y-5">
        <IssuesNav />
        {teams && teams.length > 0 && (
          <Select value={teamId ?? undefined} onValueChange={chooseTeam}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Team" />
            </SelectTrigger>
            <SelectContent>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !teams?.length ? (
          <EmptyState
            icon={<RefreshCcw className="h-5 w-5" />}
            title="No teams yet"
            description="Cycles belong to a team. Create a team first."
            action={
              <Link href="/issues/teams">
                <Button>Go to Teams</Button>
              </Link>
            }
          />
        ) : isError ? (
          <EmptyState
            icon={<RefreshCcw className="h-5 w-5" />}
            title="Couldn't load cycles"
            description="Try refreshing the page."
          />
        ) : !cycles?.length ? (
          <EmptyState
            icon={<RefreshCcw className="h-5 w-5" />}
            title="No cycles yet"
            description="Plan work in one- or two-week cycles and track how much of it lands."
            action={
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> New cycle
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            <CycleSection title="Current" cycles={grouped.current} />
            <CycleSection title="Upcoming" cycles={grouped.upcoming} />
            <CycleSection title="Past" cycles={grouped.past} />
          </div>
        )}
      </PageBody>
      {teamId && (
        <NewCycleDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          teamId={teamId}
          cycles={cycles ?? []}
        />
      )}
    </AppShell>
  );
}
