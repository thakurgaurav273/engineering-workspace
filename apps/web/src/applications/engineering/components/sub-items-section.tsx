import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, Avatar, Badge, Button } from "@grovyn/ui/primitives";
import { Checkbox } from "@grovyn/ui/components/checkbox";
import { avatarColor, userInitials, fmtDate } from "@grovyn/utils";
import {
  useCreateWorkspaceItem,
  useMoveWorkspaceItem,
} from "@/applications/engineering/hooks/use-workspace";
import { workspaceStatusLabel, type WorkspaceItem } from "@/applications/engineering/lib/workspace";
import { Plus } from "lucide-react";

// Team / parent / sub-issue-count badges shared by the board cards and list rows.
export function ItemRelationBadges({ item }: { item: WorkspaceItem }) {
  const childCount = item._count?.children ?? 0;
  return (
    <>
      {item.team && <Badge>{item.team.key}</Badge>}
      {item.parent && (
        <span title={`Sub-issue of ${item.parent.title}`} className="inline-flex max-w-[160px]">
          <Badge className="truncate">↳ {item.parent.title}</Badge>
        </span>
      )}
      {childCount > 0 && (
        <Badge>
          {childCount} sub-issue{childCount === 1 ? "" : "s"}
        </Badge>
      )}
    </>
  );
}

// Sub-issues for an item, Linear-style: a progress bar, a checklist of children that
// link through to their own pages, and an inline "add" row. Children nest one level
// only (the API enforces it), so an item that is itself a sub-item can't have its own.
export function SubItemsSection({ item, canManage }: { item: WorkspaceItem; canManage: boolean }) {
  const queryClient = useQueryClient();
  const createMutation = useCreateWorkspaceItem();
  const moveMutation = useMoveWorkspaceItem();
  const [title, setTitle] = useState("");

  const subItems = item.subItems ?? [];
  const progress = item.subItemProgress ?? { done: 0, total: subItems.length };
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const canAdd = canManage && !item.parentId;

  // useMoveWorkspaceItem only refreshes the board and summary, so refresh this item's
  // detail too - that is where the progress count and the child list come from.
  const refreshItem = () =>
    queryClient.invalidateQueries({ queryKey: ["workspace", "item", item.id] });

  const add = () => {
    const trimmed = title.trim();
    if (trimmed.length < 2) return;
    createMutation.mutate(
      {
        title: trimmed,
        parentId: item.id,
        ownerId: item.ownerId,
        teamId: item.teamId ?? undefined,
      },
      { onSuccess: () => setTitle("") },
    );
  };

  if (item.parentId && !subItems.length) return null;

  return (
    <Card>
      <CardHeader
        title="Sub-issues"
        subtitle={
          progress.total
            ? `${progress.done} of ${progress.total} done`
            : "Break this item into smaller pieces."
        }
      />
      <div className="space-y-3 p-5">
        {progress.total > 0 && (
          <div
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-primary/80" style={{ width: `${pct}%` }} />
          </div>
        )}

        {subItems.length > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border">
            {subItems.map((sub) => {
              const done = sub.status === "DONE";
              return (
                <li key={sub.id} className="flex items-center gap-2.5 px-3 py-2">
                  <Checkbox
                    checked={done}
                    disabled={!canManage}
                    aria-label={done ? `Reopen ${sub.title}` : `Mark ${sub.title} done`}
                    onCheckedChange={(checked) =>
                      moveMutation.mutate(
                        { id: sub.id, status: checked ? "DONE" : "PENDING" },
                        { onSettled: refreshItem },
                      )
                    }
                  />
                  <Link
                    href={`/workspace/${sub.id}`}
                    className={`min-w-0 flex-1 truncate text-[13px] hover:underline ${
                      done ? "text-muted-foreground line-through" : "text-foreground"
                    }`}
                  >
                    {sub.title}
                  </Link>
                  {sub.status === "IN_PROGRESS" && (
                    <Badge tone="info">{workspaceStatusLabel(sub.status)}</Badge>
                  )}
                  {sub.dueDate && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {fmtDate(sub.dueDate)}
                    </span>
                  )}
                  <Avatar
                    initials={userInitials(sub.owner.firstName, sub.owner.lastName)}
                    color={avatarColor(sub.owner.id)}
                    size="xs"
                    src={sub.owner.avatarUrl}
                  />
                </li>
              );
            })}
          </ul>
        )}

        {canAdd && (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a sub-issue…"
              maxLength={200}
              aria-label="New sub-issue title"
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-[13px] outline-none focus:border-foreground/40"
            />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={title.trim().length < 2 || createMutation.isPending}
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}
