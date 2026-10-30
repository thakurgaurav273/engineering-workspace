"use client";
import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { Card } from "@grovyn/ui/primitives";
import { cn, fmtDate, fullName } from "@grovyn/utils";
import { useTrackerMode } from "@/platform/registry/app-registry";
import { useMyIssues } from "@/applications/engineering/hooks/use-issues";
import { isIssueOverdue, type Issue } from "@/applications/engineering/lib/issues";
import { PersonAvatar, PriorityIcon, StatusIcon } from "./issue-ui";

const MAX_ROWS = 8;

/**
 * Read-only slice of the Issues tracker inside My Workspace: open issues on my plate
 * ("assigned") or ones I created for someone else ("delegated"). Hidden for orgs on
 * Linear and when there's nothing to show.
 */
export function WorkspaceIssuesSection({ mode }: { mode: "assigned" | "delegated" }) {
  const { data: trackerMode } = useTrackerMode();
  const { data } = useMyIssues(trackerMode === "internal");
  if (trackerMode !== "internal") return null;

  const issues = data?.[mode] ?? [];
  if (!issues.length) return null;

  const title = mode === "assigned" ? "Issues assigned to you" : "Issues you assigned";
  const viewAll = `/issues?view=${mode === "assigned" ? "assigned" : "created"}`;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
          <span className="font-mono-num text-[12px] text-muted-foreground">{issues.length}</span>
        </div>
        <Link
          href="/issues"
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
        >
          Open Issues <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <ul>
        {issues.slice(0, MAX_ROWS).map((issue) => (
          <IssueLine key={issue.id} issue={issue} showAssignee={mode === "delegated"} />
        ))}
      </ul>
      {issues.length > MAX_ROWS && (
        <Link
          href={viewAll}
          className="block border-t border-border px-4 py-2 text-[12px] text-muted-foreground hover:text-foreground"
        >
          View all {issues.length}
        </Link>
      )}
    </Card>
  );
}

function IssueLine({ issue, showAssignee }: { issue: Issue; showAssignee: boolean }) {
  const overdue = isIssueOverdue(issue);
  return (
    <li className="border-b border-border/60 last:border-b-0">
      <Link
        href={`/issues/${issue.id}`}
        className="flex h-10 items-center gap-2.5 px-4 text-[13px] hover:bg-accent/50"
      >
        <PriorityIcon priority={issue.priority} />
        <span className="w-[64px] shrink-0 truncate font-mono-num text-[12px] text-muted-foreground">
          {issue.identifier}
        </span>
        <StatusIcon status={issue.status} />
        <span className="min-w-0 flex-1 truncate text-foreground">{issue.title}</span>
        {showAssignee && issue.assignee && (
          <span className="hidden items-center gap-1.5 text-[12px] text-muted-foreground sm:inline-flex">
            <PersonAvatar person={issue.assignee} />
            <span className="max-w-[120px] truncate">
              {fullName(issue.assignee.firstName, issue.assignee.lastName)}
            </span>
          </span>
        )}
        {issue.dueDate && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 font-mono-num text-[11.5px]",
              overdue ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground",
            )}
            title={overdue ? "Overdue" : "Due date"}
          >
            <CalendarDays className="h-3 w-3" />
            {fmtDate(issue.dueDate)}
          </span>
        )}
      </Link>
    </li>
  );
}
