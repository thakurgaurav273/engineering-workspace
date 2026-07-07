import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { Card, Avatar, Progress } from "@grovyn/ui/primitives";
import { cn } from "@grovyn/utils";
import { avatarColor, userInitials, fullName, relativeTime, fmtDate } from "@grovyn/utils";

export type TaskUpdateStatus = "on_track" | "at_risk" | "blocked" | "in_review" | "done";
export type LinearWorkflowType = "backlog" | "unstarted" | "started" | "completed" | "canceled";

export interface IssueAssignee {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  managerId?: string | null;
}

export interface IssueListItem {
  id: string;
  identifier: string;
  title: string;
  url: string;
  stateName: string;
  stateType: LinearWorkflowType;
  priority: number | null;
  estimate: number | null;
  dueDate: string | null;
  assigneeId: string | null;
  syncedAt: string;
  assignee: IssueAssignee | null;
  updates: {
    id: string;
    body: string;
    status: TaskUpdateStatus;
    progress: number | null;
    createdAt: string;
  }[];
}

export interface TaskUpdateItem {
  id: string;
  body: string;
  progress: number | null;
  status: TaskUpdateStatus;
  timeSpentMinutes: number | null;
  isEdited: boolean;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: { id: string; firstName: string; lastName: string; avatarUrl?: string | null };
  issue: { id: string; identifier: string; title: string; url: string };
  attachments: unknown[];
}

export function taskUpdateStatusLabel(status: TaskUpdateStatus): string {
  const labels: Record<TaskUpdateStatus, string> = {
    on_track: "On track",
    at_risk: "At risk",
    blocked: "Blocked",
    in_review: "In review",
    done: "Done",
  };
  return labels[status];
}

export function workflowStateLabel(state: LinearWorkflowType): string {
  const labels: Record<LinearWorkflowType, string> = {
    backlog: "Backlog",
    unstarted: "Todo",
    started: "In progress",
    completed: "Completed",
    canceled: "Canceled",
  };
  return labels[state];
}

export function ProgressStatusPill({ status }: { status: TaskUpdateStatus }) {
  const styles: Record<TaskUpdateStatus, string> = {
    on_track: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    at_risk: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    blocked: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
    in_review: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    done: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20",
  };
  const dot: Record<TaskUpdateStatus, string> = {
    on_track: "bg-emerald-500",
    at_risk: "bg-amber-500",
    blocked: "bg-rose-500",
    in_review: "bg-blue-500",
    done: "bg-violet-500",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium",
        styles[status],
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot[status])} />
      {taskUpdateStatusLabel(status)}
    </span>
  );
}

export function IssueCard({ issue }: { issue: IssueListItem }) {
  const latest = issue.updates[0];
  return (
    <Link to="/task-updates/$issueId" params={{ issueId: issue.id }} className="group block">
      <Card className="p-5 hover:border-foreground/20 hover:shadow-sm transition-all h-full flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono-num">
              <span>{issue.identifier}</span>
              <a
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="mt-1 text-[14px] font-semibold text-foreground truncate">
              {issue.title}
            </div>
          </div>
          {latest && <ProgressStatusPill status={latest.status} />}
        </div>

        {latest ? (
          <p className="mt-3 text-[12.5px] text-muted-foreground line-clamp-2 flex-1">
            {latest.body}
          </p>
        ) : (
          <p className="mt-3 text-[12.5px] text-muted-foreground italic flex-1">
            No updates posted yet.
          </p>
        )}

        {latest?.progress != null && (
          <div className="mt-3 flex items-center gap-3">
            <Progress value={latest.progress} className="flex-1" />
            <span className="font-mono-num text-[11.5px] font-semibold shrink-0 w-9 text-right">
              {latest.progress}%
            </span>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
          <span>{issue.stateName}</span>
          <span>
            {issue.dueDate
              ? `Due ${fmtDate(issue.dueDate)}`
              : latest
                ? relativeTime(latest.createdAt)
                : "-"}
          </span>
        </div>
      </Card>
    </Link>
  );
}

export function TaskUpdateTimelineItem({
  update,
  canManage,
  onEdit,
  onDelete,
}: {
  update: TaskUpdateItem;
  canManage?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <Avatar
          initials={userInitials(update.author.firstName, update.author.lastName)}
          color={avatarColor(update.author.id)}
          size="md"
          src={update.author.avatarUrl}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold">
              {fullName(update.author.firstName, update.author.lastName)}
            </span>
            <ProgressStatusPill status={update.status} />
            {update.isEdited && (
              <span className="text-[10.5px] text-muted-foreground">(edited)</span>
            )}
            <span className="ml-auto text-[11px] text-muted-foreground font-mono-num">
              {relativeTime(update.createdAt)}
            </span>
          </div>
          <p className="mt-2 text-[13px] text-foreground leading-relaxed whitespace-pre-wrap">
            {update.body}
          </p>
          <div className="mt-3 flex items-center gap-4 text-[11.5px] text-muted-foreground">
            {update.progress != null && <span>{update.progress}% progress</span>}
            {update.timeSpentMinutes != null && (
              <span>{Math.round((update.timeSpentMinutes / 60) * 10) / 10}h logged</span>
            )}
            {canManage && (
              <div className="ml-auto flex items-center gap-3">
                {onEdit && (
                  <button
                    onClick={onEdit}
                    className="hover:text-foreground underline underline-offset-2"
                  >
                    Edit
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={onDelete}
                    className="hover:text-rose-600 dark:hover:text-rose-400 underline underline-offset-2"
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
