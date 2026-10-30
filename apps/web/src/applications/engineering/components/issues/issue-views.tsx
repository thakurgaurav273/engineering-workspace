"use client";
import { type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Hexagon,
  Plus,
  Info,
} from "lucide-react";
import { cn, fmtDate, fullName } from "@grovyn/utils";
import { Skeleton } from "@grovyn/ui/primitives";
import { useOrgMembers } from "@/applications/engineering/hooks/use-org-members";
import { useStates, useUpdateIssue } from "@/applications/engineering/hooks/use-issues";
import { useTrackerMode } from "@/platform/registry/app-registry";
import {
  CATEGORY_LABEL,
  STATE_CATEGORIES,
  isIssueOverdue,
  sortStates,
  type Issue,
  type IssueState,
  type IssueStateCategory,
  type Person,
} from "@/applications/engineering/lib/issues";
import {
  AssigneePicker,
  LabelChip,
  PersonAvatar,
  PriorityIcon,
  PriorityPicker,
  StatusIcon,
  StatusPicker,
} from "./issue-ui";

// ---------------------------------------------------------------- sub-navigation

const TABS = [
  { href: "/issues", label: "Issues", exact: true },
  { href: "/issues/projects", label: "Projects" },
  { href: "/issues/cycles", label: "Cycles" },
  { href: "/issues/teams", label: "Teams" },
];

/** Tab strip shared by every Issues page, plus a notice when the org runs on Linear. */
export function IssuesNav() {
  const pathname = usePathname();
  const { data: mode } = useTrackerMode();
  // /issues/<id> is an issue detail, which belongs to the Issues tab.
  const active = (tab: (typeof TABS)[number]) =>
    tab.exact
      ? pathname === "/issues" || !TABS.slice(1).some((t) => pathname.startsWith(t.href))
      : pathname.startsWith(tab.href);
  return (
    <div className="space-y-3">
      {mode === "linear" && (
        <div className="flex items-start gap-2 rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Your organization is connected to Linear, so engineering work is tracked in{" "}
            <Link href="/task-updates" className="text-foreground underline underline-offset-2">
              Task Updates
            </Link>
            . These built-in issues are independent of Linear.
          </span>
        </div>
      )}
      <nav className="flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-[12.5px] font-medium transition-colors",
              active(tab)
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

// ---------------------------------------------------------------- list

function DueBadge({ issue }: { issue: Issue }) {
  if (!issue.dueDate) return null;
  const overdue = isIssueOverdue(issue);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11.5px] font-mono-num",
        overdue ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground",
      )}
      title={overdue ? "Overdue" : "Due date"}
    >
      <CalendarDays className="h-3 w-3" />
      {fmtDate(issue.dueDate)}
    </span>
  );
}

export function IssueRow({
  issue,
  people,
  showTeam,
}: {
  issue: Issue;
  people: Person[];
  showTeam?: boolean;
}) {
  const router = useRouter();
  const update = useUpdateIssue();
  const set = (body: Parameters<typeof update.mutate>[0]) => update.mutate(body);
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/issues/${issue.id}`)}
      onKeyDown={(e) => e.key === "Enter" && router.push(`/issues/${issue.id}`)}
      className="group flex h-10 cursor-pointer items-center gap-2.5 border-b border-border/60 px-3 text-[13px] hover:bg-accent/50 focus:bg-accent/50 focus:outline-none"
    >
      <span onClick={stop} className="flex">
        <PriorityPicker
          value={issue.priority}
          onChange={(priority) => set({ id: issue.id, priority })}
          trigger={
            <button
              className="grid h-6 w-6 place-items-center rounded hover:bg-accent"
              aria-label="Priority"
            >
              <PriorityIcon priority={issue.priority} />
            </button>
          }
        />
      </span>
      <span className="w-[68px] shrink-0 truncate font-mono-num text-[12px] text-muted-foreground">
        {issue.identifier}
      </span>
      <span onClick={stop} className="flex">
        <StatusPicker
          teamId={issue.teamId}
          value={issue.state}
          onChange={(state) => set({ id: issue.id, stateId: state.id, optimisticState: state })}
          trigger={
            <button
              className="grid h-6 w-6 place-items-center rounded hover:bg-accent"
              aria-label="Status"
            >
              <StatusIcon state={issue.state} />
            </button>
          }
        />
      </span>
      <span className="min-w-0 flex-1 truncate">
        <span className="text-foreground">{issue.title}</span>
        {issue.parent && (
          <span className="ml-2 text-[11.5px] text-muted-foreground">
            › {issue.parent.identifier}
          </span>
        )}
      </span>
      {issue._count.children > 0 && (
        <span
          className="hidden items-center gap-1 text-[11.5px] text-muted-foreground sm:inline-flex"
          title="Sub-issues"
        >
          <GitBranch className="h-3 w-3" />
          {issue._count.children}
        </span>
      )}
      <span className="hidden items-center gap-1 md:flex">
        {issue.labels.slice(0, 2).map((l) => (
          <LabelChip key={l.id} label={l} />
        ))}
        {issue.labels.length > 2 && (
          <span className="text-[11px] text-muted-foreground">+{issue.labels.length - 2}</span>
        )}
      </span>
      {issue.project && (
        <span className="hidden max-w-[140px] items-center gap-1 truncate text-[11.5px] text-muted-foreground lg:inline-flex">
          <Hexagon className="h-3 w-3 shrink-0" />
          <span className="truncate">{issue.project.name}</span>
        </span>
      )}
      {showTeam && (
        <span className="hidden text-[11px] text-muted-foreground lg:inline">
          {issue.team.name}
        </span>
      )}
      <DueBadge issue={issue} />
      <span onClick={stop} className="flex">
        <AssigneePicker
          value={issue.assignee}
          people={people}
          onChange={(assigneeId) => set({ id: issue.id, assigneeId })}
          trigger={
            <button
              className="rounded-full"
              aria-label="Assignee"
              title={
                issue.assignee
                  ? fullName(issue.assignee.firstName, issue.assignee.lastName)
                  : "Unassigned"
              }
            >
              <PersonAvatar person={issue.assignee} />
            </button>
          }
        />
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- grouping

/** Where "+" in a group creates the issue: a specific status, or a category (any team). */
export type CreateTarget = { stateId?: string; category?: IssueStateCategory };

interface Bucket {
  key: string;
  label: string;
  icon: Pick<IssueState, "category" | "color" | "position">;
  match: (issue: Issue) => boolean;
  target: CreateTarget;
  category: IssueStateCategory;
  /** The status itself, for single-team buckets. */
  state?: IssueState;
}

const CATEGORY_ICON_COLOR: Record<IssueStateCategory, string> = {
  BACKLOG: "#94a3b8",
  UNSTARTED: "#94a3b8",
  STARTED: "#f59e0b",
  COMPLETED: "#6366f1",
  CANCELED: "#64748b",
};

/**
 * Groups for the list/board. One team: that team's own statuses, in workflow order. Several
 * teams: statuses differ per team, so group by the shared category instead.
 */
function useBuckets(teamId?: string): Bucket[] {
  const { data: states = [] } = useStates(teamId ?? null, !!teamId);
  if (teamId) {
    return sortStates(states).map((state) => ({
      key: state.id,
      label: state.name,
      icon: state,
      match: (issue) => issue.stateId === state.id,
      target: { stateId: state.id },
      category: state.category,
      state,
    }));
  }
  return STATE_CATEGORIES.map((category) => ({
    key: category,
    label: CATEGORY_LABEL[category],
    icon: { category, color: CATEGORY_ICON_COLOR[category], position: 0 },
    match: (issue) => issue.state.category === category,
    target: { category },
    category,
  }));
}

/** Linear's list layout: one collapsible section per status with a quick-add button. */
export function IssueList({
  issues,
  people,
  teamId,
  onCreate,
  showTeam,
  hideEmpty = true,
}: {
  issues: Issue[];
  people: Person[];
  /** Set when every issue belongs to this team: groups use its own statuses. */
  teamId?: string;
  onCreate?: (target: CreateTarget) => void;
  showTeam?: boolean;
  hideEmpty?: boolean;
}) {
  const buckets = useBuckets(teamId);
  // Canceled work starts folded away.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isOpen = (b: Bucket) => expanded[b.key] ?? b.category !== "CANCELED";
  const groups = buckets
    .map((bucket) => ({ bucket, items: issues.filter(bucket.match) }))
    .filter((g) => !hideEmpty || g.items.length > 0);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {groups.map(({ bucket, items }) => (
        <section key={bucket.key}>
          <header className="flex h-9 items-center gap-2 border-b border-border bg-surface px-3 text-[12.5px]">
            <button
              onClick={() => setExpanded((prev) => ({ ...prev, [bucket.key]: !isOpen(bucket) }))}
              className="flex flex-1 items-center gap-2 text-left"
            >
              {isOpen(bucket) ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <StatusIcon state={bucket.icon} />
              <span className="font-medium">{bucket.label}</span>
              <span className="font-mono-num text-muted-foreground">{items.length}</span>
            </button>
            {onCreate && (
              <button
                onClick={() => onCreate(bucket.target)}
                className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={`New ${bucket.label} issue`}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </header>
          {isOpen(bucket) &&
            items.map((issue) => (
              <IssueRow key={issue.id} issue={issue} people={people} showTeam={showTeam} />
            ))}
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- board

function BoardCard({ issue, overlay }: { issue: Issue; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: issue.id });
  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      className={cn(
        "rounded-md border border-border bg-card p-3 text-[13px] shadow-sm transition-shadow hover:border-foreground/20",
        isDragging && !overlay && "opacity-40",
        overlay && "rotate-1 shadow-lg",
      )}
    >
      <Link href={`/issues/${issue.id}`} className="block" draggable={false}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono-num text-[11.5px] text-muted-foreground">
            {issue.identifier}
          </span>
          <PersonAvatar person={issue.assignee} />
        </div>
        <div className="mt-1.5 flex items-start gap-2">
          <StatusIcon state={issue.state} className="mt-0.5" />
          <span className="line-clamp-2 font-medium leading-snug text-foreground">
            {issue.title}
          </span>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="grid h-5 w-5 place-items-center rounded border border-border">
            <PriorityIcon priority={issue.priority} />
          </span>
          {issue.labels.slice(0, 2).map((l) => (
            <LabelChip key={l.id} label={l} />
          ))}
          {issue._count.children > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <GitBranch className="h-3 w-3" />
              {issue._count.children}
            </span>
          )}
          <DueBadge issue={issue} />
        </div>
      </Link>
    </div>
  );
}

function BoardColumn({
  bucket,
  count,
  onCreate,
  children,
}: {
  bucket: Bucket;
  count: number;
  onCreate?: (target: CreateTarget) => void;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: bucket.key });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[280px] shrink-0 flex-col rounded-lg bg-surface/60 transition-colors",
        isOver && "bg-accent/60",
      )}
    >
      <header className="flex h-10 items-center gap-2 px-3 text-[12.5px]">
        <StatusIcon state={bucket.icon} />
        <span className="truncate font-medium">{bucket.label}</span>
        <span className="font-mono-num text-muted-foreground">{count}</span>
        {onCreate && (
          <button
            onClick={() => onCreate(bucket.target)}
            className="ml-auto grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={`New ${bucket.label} issue`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </header>
      <div className="flex min-h-[120px] flex-1 flex-col gap-2 px-2 pb-2">{children}</div>
    </div>
  );
}

/**
 * Kanban: one column per status (single team) or per category (several teams). Dropping a
 * card on a category column moves it to its own team's first status in that category.
 */
export function IssueBoard({
  issues,
  teamId,
  onCreate,
}: {
  issues: Issue[];
  teamId?: string;
  onCreate?: (target: CreateTarget) => void;
}) {
  const update = useUpdateIssue();
  const buckets = useBuckets(teamId);
  const { data: allStates = [] } = useStates(null, !teamId);
  const [dragging, setDragging] = useState<Issue | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  // Canceled columns stay off the board unless something is in them, like Linear's default.
  const columns = buckets.filter((b) => b.category !== "CANCELED" || issues.some(b.match));

  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    const issue = issues.find((i) => i.id === event.active.id);
    const bucket = buckets.find((b) => b.key === event.over?.id);
    if (!issue || !bucket || bucket.match(issue)) return;
    const target =
      bucket.state ??
      sortStates(allStates.filter((s) => s.teamId === issue.teamId)).find(
        (s) => s.category === bucket.category,
      );
    if (!target) return;
    update.mutate({ id: issue.id, stateId: target.id, optimisticState: target });
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setDragging(issues.find((i) => i.id === e.active.id) ?? null)}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((bucket) => {
          const items = issues.filter(bucket.match);
          return (
            <BoardColumn key={bucket.key} bucket={bucket} count={items.length} onCreate={onCreate}>
              {items.map((issue) => (
                <BoardCard key={issue.id} issue={issue} />
              ))}
            </BoardColumn>
          );
        })}
      </div>
      <DragOverlay>{dragging && <BoardCard issue={dragging} overlay />}</DragOverlay>
    </DndContext>
  );
}

/** Thin progress bar + "3/8" used by projects, cycles and sub-issues. */
export function ProgressBar({
  done,
  total,
  className,
}: {
  done: number;
  total: number;
  className?: string;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="shrink-0 font-mono-num text-[11.5px] text-muted-foreground">
        {done}/{total}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- loading states

// Fixed (not random) widths so the placeholder doesn't jump between renders.
const CARD_TITLE_WIDTHS = ["w-[85%]", "w-[65%]", "w-full", "w-[75%]"];
const TITLE_WIDTHS = ["w-[46%]", "w-[62%]", "w-[38%]", "w-[55%]", "w-[30%]", "w-[50%]", "w-[42%]"];

/** Placeholder shaped like IssueList: two status groups of rows. */
export function IssueListSkeleton({ rows = 7 }: { rows?: number }) {
  const groups = [Math.ceil(rows / 2), Math.floor(rows / 2)];
  return (
    <div
      className="overflow-hidden rounded-lg border border-border bg-card"
      aria-busy
      aria-label="Loading issues"
    >
      {groups.map((count, g) => (
        <section key={g}>
          <header className="flex h-9 items-center gap-2 border-b border-border bg-surface px-3">
            <Skeleton className="h-3.5 w-3.5 rounded-full" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-4" />
          </header>
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="flex h-10 items-center gap-2.5 border-b border-border/60 px-3">
              <Skeleton className="h-3.5 w-3.5 rounded-sm" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3.5 w-3.5 rounded-full" />
              <Skeleton className={cn("h-3", TITLE_WIDTHS[(g * 3 + i) % TITLE_WIDTHS.length])} />
              <span className="flex-1" />
              <Skeleton className="hidden h-4 w-14 rounded-full md:block" />
              <Skeleton className="h-5 w-5 rounded-full" />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

/** Placeholder shaped like IssueBoard: a few columns of cards. */
export function IssueBoardSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex gap-3 overflow-hidden pb-2" aria-busy aria-label="Loading issues">
      {Array.from({ length: columns }).map((_, c) => (
        <div key={c} className="flex w-[280px] shrink-0 flex-col rounded-lg bg-surface/60">
          <div className="flex h-10 items-center gap-2 px-3">
            <Skeleton className="h-3.5 w-3.5 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex flex-col gap-2 px-2 pb-2">
            {Array.from({ length: 3 - (c % 2) }).map((_, i) => (
              <div key={i} className="space-y-2.5 rounded-md border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-5 w-5 rounded-full" />
                </div>
                <Skeleton
                  className={cn("h-3.5", CARD_TITLE_WIDTHS[(c + i) % CARD_TITLE_WIDTHS.length])}
                />
                <div className="flex gap-1.5">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
