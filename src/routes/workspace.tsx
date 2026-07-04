import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Plus, Search, Archive as ArchiveIcon, AlertTriangle, CalendarClock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader, PageBody, Button, EmptyState, Skeleton, Kbd } from "@/components/primitives";
import { BOARD_COLUMNS, WorkspaceColumn, WorkspaceCard } from "@/components/workspace-board";
import { WorkspaceItemDialog } from "@/components/workspace-item-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  useWorkspaceBoard,
  useWorkspaceList,
  useCreateWorkspaceItem,
  useUpdateWorkspaceItem,
  useMoveWorkspaceItem,
  useArchiveWorkspaceItem,
  useDeleteWorkspaceItem,
} from "@/hooks/use-workspace";
import type {
  WorkspaceItem,
  WorkspacePriority,
  WorkspaceSource,
  WorkspaceStatus,
} from "@/lib/workspace";

export const Route = createFileRoute("/workspace")({ component: WorkspacePage });

type SortKey = "createdAt" | "dueDate" | "priority" | "title";

const PRIORITY_RANK: Record<WorkspacePriority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function isOverdue(item: WorkspaceItem): boolean {
  return !!item.dueDate && item.status !== "DONE" && new Date(item.dueDate).getTime() < Date.now();
}

function isDueToday(item: WorkspaceItem): boolean {
  if (!item.dueDate) return false;
  return new Date(item.dueDate).toDateString() === new Date().toDateString();
}

function WorkspacePage() {
  const { data: board, isLoading } = useWorkspaceBoard();
  const createMutation = useCreateWorkspaceItem();
  const updateMutation = useUpdateWorkspaceItem();
  const moveMutation = useMoveWorkspaceItem();
  const archiveMutation = useArchiveWorkspaceItem();
  const deleteMutation = useDeleteWorkspaceItem();

  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<WorkspacePriority | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<WorkspaceSource | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [quickFilter, setQuickFilter] = useState<"none" | "overdue" | "dueToday">("none");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkspaceItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<WorkspaceItem | null>(null);
  const [archiveSheetOpen, setArchiveSheetOpen] = useState(false);
  const [activeDragItem, setActiveDragItem] = useState<WorkspaceItem | null>(null);

  const { data: archivedList, isLoading: archivedLoading } = useWorkspaceList(
    { includeArchived: true, status: "DONE", limit: 100 },
    archiveSheetOpen,
  );
  const archivedItems = (archivedList?.data ?? []).filter((i) => !!i.archivedAt);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Keyboard shortcuts: N opens quick-add unless typing in a field or a dialog is already open.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (e.key.toLowerCase() === "n" && !typing && !dialogOpen) {
        e.preventDefault();
        setEditingItem(null);
        setDialogOpen(true);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dialogOpen]);

  const filterAndSort = useMemo(() => {
    return (items: WorkspaceItem[]) => {
      let out = items;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        out = out.filter(
          (i) =>
            i.title.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q),
        );
      }
      if (priorityFilter !== "all") out = out.filter((i) => i.priority === priorityFilter);
      if (sourceFilter !== "all") out = out.filter((i) => i.source === sourceFilter);
      if (quickFilter === "overdue") out = out.filter(isOverdue);
      if (quickFilter === "dueToday") out = out.filter(isDueToday);

      const sorted = [...out].sort((a, b) => {
        switch (sortKey) {
          case "dueDate":
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          case "priority":
            return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
          case "title":
            return a.title.localeCompare(b.title);
          default:
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
      });
      return sorted;
    };
  }, [search, priorityFilter, sourceFilter, quickFilter, sortKey]);

  const columns = useMemo(() => {
    const empty: Record<WorkspaceStatus, WorkspaceItem[]> = {
      PENDING: [],
      IN_PROGRESS: [],
      DONE: [],
    };
    if (!board) return empty;
    return {
      PENDING: filterAndSort(board.PENDING),
      IN_PROGRESS: filterAndSort(board.IN_PROGRESS),
      DONE: filterAndSort(board.DONE),
    };
  }, [board, filterAndSort]);

  const allItems = useMemo(
    () => [...(board?.PENDING ?? []), ...(board?.IN_PROGRESS ?? []), ...(board?.DONE ?? [])],
    [board],
  );
  const overdueCount = allItems.filter(isOverdue).length;
  const dueTodayCount = allItems.filter(isDueToday).length;

  const findItem = (id: string) => allItems.find((i) => i.id === id);

  const handleDragStart = (event: DragStartEvent) => {
    const item = findItem(event.active.id as string);
    setActiveDragItem(item ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragItem(null);
    const { active, over } = event;
    if (!over) return;
    const newStatus = over.id as WorkspaceStatus;
    const item = findItem(active.id as string);
    if (!item || item.status === newStatus) return;
    moveMutation.mutate({ id: item.id, status: newStatus });
  };

  return (
    <AppShell>
      <PageHeader
        title="My Workspace"
        description="Your personal space for reminders, follow-ups, and action items from Slack, WhatsApp, email, calls, and meetings. Linear stays the source of truth for engineering work."
        actions={
          <>
            <Button variant="secondary" onClick={() => setArchiveSheetOpen(true)}>
              <ArchiveIcon className="h-3.5 w-3.5" /> Archive
            </Button>
            <Button
              onClick={() => {
                setEditingItem(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" /> New item <Kbd>N</Kbd>
            </Button>
          </>
        }
      />
      <PageBody className="space-y-4">
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:flex-wrap">
          <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or notes"
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            />
          </div>

          <Select
            value={priorityFilter}
            onValueChange={(v) => setPriorityFilter(v as WorkspacePriority | "all")}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="URGENT">Urgent</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sourceFilter}
            onValueChange={(v) => setSourceFilter(v as WorkspaceSource | "all")}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="MANUAL">Manual</SelectItem>
              <SelectItem value="LINEAR">Linear</SelectItem>
              <SelectItem value="SLACK">Slack</SelectItem>
              <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
              <SelectItem value="EMAIL">Email</SelectItem>
              <SelectItem value="MEETING">Meeting</SelectItem>
              <SelectItem value="PHONE_CALL">Phone call</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Newest</SelectItem>
              <SelectItem value="dueDate">Due date</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="title">Title</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setQuickFilter(quickFilter === "overdue" ? "none" : "overdue")}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${quickFilter === "overdue" ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              <AlertTriangle className="h-3 w-3" /> Overdue{" "}
              {overdueCount > 0 && <span className="font-mono-num">{overdueCount}</span>}
            </button>
            <button
              onClick={() => setQuickFilter(quickFilter === "dueToday" ? "none" : "dueToday")}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${quickFilter === "dueToday" ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              <CalendarClock className="h-3 w-3" /> Due today{" "}
              {dueTodayCount > 0 && <span className="font-mono-num">{dueTodayCount}</span>}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2.5 rounded-lg border border-border p-3">
                <Skeleton className="h-4 w-24" />
                {Array.from({ length: 2 }).map((_, j) => (
                  <Skeleton key={j} className="h-20 w-full rounded-md" />
                ))}
              </div>
            ))}
          </div>
        ) : !allItems.length ? (
          <EmptyState
            icon={<Plus className="h-5 w-5" />}
            title="Your workspace is empty"
            description='Capture the small stuff — "Call client tomorrow", "Review PR", "Reply to WhatsApp message" — press N to add your first item.'
            action={
              <Button
                onClick={() => {
                  setEditingItem(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                New item
              </Button>
            }
          />
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {BOARD_COLUMNS.map((status) => (
                <WorkspaceColumn
                  key={status}
                  status={status}
                  items={columns[status]}
                  onCardClick={(item) => {
                    setEditingItem(item);
                    setDialogOpen(true);
                  }}
                  onEdit={(item) => {
                    setEditingItem(item);
                    setDialogOpen(true);
                  }}
                  onDelete={(item) => setDeletingItem(item)}
                  onArchive={(item) => archiveMutation.mutate(item.id)}
                />
              ))}
            </div>
            <DragOverlay>
              {activeDragItem && (
                <div className="rotate-2 opacity-90">
                  <WorkspaceCard
                    item={activeDragItem}
                    onClick={() => {}}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    onArchive={() => {}}
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </PageBody>

      <WorkspaceItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editingItem}
        isSaving={createMutation.isPending || updateMutation.isPending}
        onCreate={(input) =>
          createMutation.mutate(input, { onSuccess: () => setDialogOpen(false) })
        }
        onUpdate={(id, input) =>
          updateMutation.mutate({ id, body: input }, { onSuccess: () => setDialogOpen(false) })
        }
      />

      <AlertDialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this action item?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deletingItem?.title}" will be removed from your workspace. This can't be undone from
              the UI.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingItem) deleteMutation.mutate(deletingItem.id);
                setDeletingItem(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={archiveSheetOpen} onOpenChange={setArchiveSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Archived items</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2.5">
            {archivedLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-md" />
              ))
            ) : !archivedItems.length ? (
              <p className="text-[12.5px] text-muted-foreground">
                No archived items yet. Completed items can be archived from the Done column.
              </p>
            ) : (
              archivedItems.map((item) => (
                <div key={item.id} className="rounded-md border border-border p-3">
                  <div className="text-[13px] font-medium">{item.title}</div>
                  {item.description && (
                    <p className="mt-1 text-[11.5px] text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
