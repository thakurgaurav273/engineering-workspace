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
import { useOrgMembers } from "@/applications/engineering/hooks/use-org-members";
import { useUpdateIssue } from "@/applications/engineering/hooks/use-issues";
import { useTrackerMode } from "@/platform/registry/app-registry";
import {
  ISSUE_STATUSES,
  STATUS_LABEL,
  isIssueOverdue,
  type Issue,
  type IssueStatus,
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
          value={issue.status}
          onChange={(status) => set({ id: issue.id, status })}
          trigger={
            <button
              className="grid h-6 w-6 place-items-center rounded hover:bg-accent"
              aria-label="Status"
            >
              <StatusIcon status={issue.status} />
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

/** Linear's list layout: one collapsible section per status with a quick-add button. */
export function IssueList({
  issues,
  people,
  onCreate,
  showTeam,
  hideEmpty = true,
}: {
  issues: Issue[];
  people: Person[];
  onCreate?: (status: IssueStatus) => void;
  showTeam?: boolean;
  hideEmpty?: boolean;
}) {
  const [collapsed, setCollapsed] = useState<Set<IssueStatus>>(new Set(["CANCELED"]));
  const groups = ISSUE_STATUSES.map((status) => ({
    status,
    items: issues.filter((i) => i.status === status),
  })).filter((g) => !hideEmpty || g.items.length > 0);

  const toggle = (status: IssueStatus) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {groups.map(({ status, items }) => (
        <section key={status}>
          <header className="flex h-9 items-center gap-2 border-b border-border bg-surface px-3 text-[12.5px]">
            <button
              onClick={() => toggle(status)}
              className="flex flex-1 items-center gap-2 text-left"
            >
              {collapsed.has(status) ? (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <StatusIcon status={status} />
              <span className="font-medium">{STATUS_LABEL[status]}</span>
              <span className="font-mono-num text-muted-foreground">{items.length}</span>
            </button>
            {onCreate && (
              <button
                onClick={() => onCreate(status)}
                className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={`New ${STATUS_LABEL[status]} issue`}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </header>
          {!collapsed.has(status) &&
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
          <StatusIcon status={issue.status} className="mt-0.5" />
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
  status,
  items,
  onCreate,
  children,
}: {
  status: IssueStatus;
  items: Issue[];
  onCreate?: (status: IssueStatus) => void;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[280px] shrink-0 flex-col rounded-lg bg-surface/60 transition-colors",
        isOver && "bg-accent/60",
      )}
    >
      <header className="flex h-10 items-center gap-2 px-3 text-[12.5px]">
        <StatusIcon status={status} />
        <span className="font-medium">{STATUS_LABEL[status]}</span>
        <span className="font-mono-num text-muted-foreground">{items.length}</span>
        {onCreate && (
          <button
            onClick={() => onCreate(status)}
            className="ml-auto grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={`New ${STATUS_LABEL[status]} issue`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </header>
      <div className="flex min-h-[120px] flex-1 flex-col gap-2 px-2 pb-2">{children}</div>
    </div>
  );
}

/** Kanban by status; dragging a card to another column changes its status. */
export function IssueBoard({
  issues,
  onCreate,
}: {
  issues: Issue[];
  onCreate?: (status: IssueStatus) => void;
}) {
  const update = useUpdateIssue();
  const [dragging, setDragging] = useState<Issue | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  // Canceled stays off the board unless something is in it, like Linear's default board.
  const columns = ISSUE_STATUSES.filter(
    (s) => s !== "CANCELED" || issues.some((i) => i.status === s),
  );

  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    const issue = issues.find((i) => i.id === event.active.id);
    const status = event.over?.id as IssueStatus | undefined;
    if (!issue || !status || issue.status === status) return;
    update.mutate({ id: issue.id, status });
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setDragging(issues.find((i) => i.id === e.active.id) ?? null)}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((status) => {
          const items = issues.filter((i) => i.status === status);
          return (
            <BoardColumn key={status} status={status} items={items} onCreate={onCreate}>
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
