import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { MoreHorizontal, Pencil, Trash2, Archive, Calendar, GripVertical } from "lucide-react";
import { useState } from "react";
import { Card, Avatar, Badge } from "@/shared/components/primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { cn } from "@/shared/lib/utils";
import { avatarColor, userInitials, fullName, fmtDate } from "@/shared/lib/transforms";
import {
  workspacePriorityLabel,
  workspaceSourceLabel,
  workspaceStatusLabel,
  type WorkspaceItem,
  type WorkspacePriority,
  type WorkspaceStatus,
} from "@/applications/engineering/lib/workspace";

export const BOARD_COLUMNS: WorkspaceStatus[] = ["PENDING", "IN_PROGRESS", "DONE"];

const PRIORITY_TONE: Record<WorkspacePriority, "neutral" | "info" | "warning" | "success"> = {
  LOW: "neutral",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "warning",
};

function isOverdue(item: WorkspaceItem): boolean {
  if (!item.dueDate || item.status === "DONE") return false;
  return new Date(item.dueDate).getTime() < Date.now();
}

function isDueToday(item: WorkspaceItem): boolean {
  if (!item.dueDate) return false;
  const d = new Date(item.dueDate);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export function WorkspaceColumn({
  status,
  items,
  onCardClick,
  onEdit,
  onDelete,
  onArchive,
}: {
  status: WorkspaceStatus;
  items: WorkspaceItem[];
  onCardClick: (item: WorkspaceItem) => void;
  onEdit: (item: WorkspaceItem) => void;
  onDelete: (item: WorkspaceItem) => void;
  onArchive: (item: WorkspaceItem) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[200px] w-full flex-col rounded-lg border border-border bg-surface/40 transition-colors duration-150",
        isOver && "border-foreground/30 bg-accent/40",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-3">
        <span className="text-[12.5px] font-semibold text-foreground">
          {workspaceStatusLabel(status)}
        </span>
        <span className="font-mono-num text-[11px] text-muted-foreground">{items.length}</span>
      </div>
      <div className="flex-1 space-y-2.5 p-2.5">
        {items.map((item) => (
          <WorkspaceCard
            key={item.id}
            item={item}
            onClick={() => onCardClick(item)}
            onEdit={() => onEdit(item)}
            onDelete={() => onDelete(item)}
            onArchive={() => onArchive(item)}
          />
        ))}
        {!items.length && (
          <div className="rounded-md border border-dashed border-border py-8 text-center text-[11.5px] text-muted-foreground">
            No items
          </div>
        )}
      </div>
    </div>
  );
}

export function WorkspaceCard({
  item,
  onClick,
  onEdit,
  onDelete,
  onArchive,
}: {
  item: WorkspaceItem;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const overdue = isOverdue(item);
  const dueToday = isDueToday(item);

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "touch-none transition-transform duration-150",
        isDragging && "z-10 opacity-40",
      )}
    >
      <Card
        className={cn(
          "group cursor-pointer p-3.5 transition-all duration-150 hover:border-foreground/20 hover:shadow-sm",
          overdue && "border-rose-500/30",
        )}
        onClick={onClick}
      >
        <div className="flex items-start gap-2">
          <button
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
            aria-label="Drag to move"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="text-[13px] font-medium leading-snug text-foreground line-clamp-2">
                {item.title}
              </div>
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:bg-accent group-hover:opacity-100"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </DropdownMenuItem>
                  {item.status === "DONE" && !item.archivedAt && (
                    <DropdownMenuItem onClick={onArchive}>
                      <Archive className="h-3.5 w-3.5" /> Archive
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={onDelete} className="text-rose-600 dark:text-rose-400">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {item.description && (
              <p className="mt-1 text-[11.5px] text-muted-foreground line-clamp-2">
                {item.description}
              </p>
            )}

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <Badge tone={PRIORITY_TONE[item.priority]}>
                {workspacePriorityLabel(item.priority)}
              </Badge>
              <Badge>{workspaceSourceLabel(item.source)}</Badge>
              {item.isClientProject && <Badge tone="success">Client</Badge>}
              {item.dueDate && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[10.5px]",
                    overdue
                      ? "text-rose-600 dark:text-rose-400 font-medium"
                      : dueToday
                        ? "text-amber-600 dark:text-amber-400 font-medium"
                        : "text-muted-foreground",
                  )}
                >
                  <Calendar className="h-3 w-3" />
                  {overdue ? "Overdue" : dueToday ? "Today" : fmtDate(item.dueDate)}
                </span>
              )}
            </div>

            {item.assignedBy && (
              <div className="mt-2.5 flex items-center gap-1.5 border-t border-border pt-2 text-[10.5px] text-muted-foreground">
                <Avatar
                  initials={userInitials(item.assignedBy.firstName, item.assignedBy.lastName)}
                  color={avatarColor(item.assignedBy.id)}
                  size="xs"
                  src={item.assignedBy.avatarUrl}
                />
                Assigned by {fullName(item.assignedBy.firstName, item.assignedBy.lastName)}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
