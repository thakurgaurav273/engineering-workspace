import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import {
  Plus,
  Search,
  Archive as ArchiveIcon,
  AlertTriangle,
  CalendarClock,
  Users,
  LayoutGrid,
  MoreHorizontal,
  Briefcase,
  Loader2,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  PageHeader,
  PageBody,
  Button,
  EmptyState,
  Skeleton,
  Kbd,
  Card,
  Avatar,
  Badge,
} from "@/components/primitives";
import { BOARD_COLUMNS, WorkspaceColumn, WorkspaceCard } from "@/components/workspace-board";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  useWorkspaceAssignedByMe,
  useCreateWorkspaceItem,
  useUpdateWorkspaceItem,
  useMoveWorkspaceItem,
  useArchiveWorkspaceItem,
  useDeleteWorkspaceItem,
  useDelegateWorkspaceItem,
} from "@/hooks/use-workspace";
import {
  workspacePriorityLabel,
  workspaceSourceLabel,
  workspaceStatusLabel,
  type WorkspaceItem,
  type WorkspacePriority,
  type WorkspaceSource,
  type WorkspaceStatus,
} from "@/lib/workspace";
import { avatarColor, userInitials, fullName, fmtDate } from "@/lib/transforms";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export const Route = createFileRoute("/workspace/")({ component: WorkspacePage });

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
  const navigate = useNavigate();
  const [view, setView] = useState<"board" | "assigned">("board");

  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<WorkspacePriority | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<WorkspaceSource | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [quickFilter, setQuickFilter] = useState<"none" | "overdue" | "dueToday" | "clientProject">(
    "none",
  );

  const debouncedSearch = useDebouncedValue(search, 300);
  const serverFilters = {
    search: debouncedSearch.trim() || undefined,
    priority: priorityFilter !== "all" ? priorityFilter : undefined,
    source: sourceFilter !== "all" ? sourceFilter : undefined,
  };
  // Counts as "searching" through the debounce window too, not just the network round
  // trip - otherwise the spinner blips off between keystrokes.
  const isSearchPending = search !== debouncedSearch;

  const { data: board, isLoading, isFetching: boardFetching } = useWorkspaceBoard(serverFilters);
  const { data: assignedList, isLoading: assignedLoading, isFetching: assignedFetching } = useWorkspaceAssignedByMe(
    { ...serverFilters, limit: 100 },
    view === "assigned",
  );
  const createMutation = useCreateWorkspaceItem();
  const updateMutation = useUpdateWorkspaceItem();
  const moveMutation = useMoveWorkspaceItem();
  const archiveMutation = useArchiveWorkspaceItem();
  const deleteMutation = useDeleteWorkspaceItem();
  const delegateMutation = useDelegateWorkspaceItem();

  const isSearching = isSearchPending || boardFetching || (view === "assigned" && assignedFetching);

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

  // search/priority/source are now applied server-side (see serverFilters above) - the
  // overdue/dueToday/client-project quick filters stay client-side since they're derived
  // booleans computed from the already-small, already-filtered result set, not text search.
  const filterAndSort = useMemo(() => {
    return (items: WorkspaceItem[]) => {
      let out = items;
      if (quickFilter === "overdue") out = out.filter(isOverdue);
      if (quickFilter === "dueToday") out = out.filter(isDueToday);
      if (quickFilter === "clientProject") out = out.filter((i) => i.isClientProject);

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
  }, [quickFilter, sortKey]);

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
  const clientProjectCount = allItems.filter((i) => i.isClientProject).length;

  const assignedItems = useMemo(
    () => filterAndSort(assignedList?.data ?? []),
    [assignedList, filterAndSort],
  );

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
        <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5 w-fit">
          <button
            onClick={() => setView("board")}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[12px] font-medium transition-colors ${view === "board" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> My Board
          </button>
          <button
            onClick={() => setView("assigned")}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[12px] font-medium transition-colors ${view === "assigned" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Users className="h-3.5 w-3.5" /> Assigned by Me
          </button>
        </div>

        <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:flex-wrap">
          <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or notes"
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            />
            {isSearching && <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />}
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
            <button
              onClick={() =>
                setQuickFilter(quickFilter === "clientProject" ? "none" : "clientProject")
              }
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${quickFilter === "clientProject" ? "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              <Briefcase className="h-3 w-3" /> Client{" "}
              {clientProjectCount > 0 && (
                <span className="font-mono-num">{clientProjectCount}</span>
              )}
            </button>
          </div>
        </div>

        {view === "board" ? (
          isLoading ? (
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
              description='Capture the small stuff - "Call client tomorrow", "Review PR", "Reply to WhatsApp message" - press N to add your first item.'
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
                    onCardClick={(item) =>
                      navigate({ to: "/workspace/$itemId", params: { itemId: item.id } })
                    }
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
          )
        ) : assignedLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-md" />
            ))}
          </div>
        ) : !assignedItems.length ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="You haven't assigned anything yet"
            description="Items you assign to teammates show up here, in whatever column they're currently in on the assignee's own board."
          />
        ) : (
          <div className="space-y-2.5">
            {assignedItems.map((item) => (
              <AssignedItemRow
                key={item.id}
                item={item}
                onClick={() => navigate({ to: "/workspace/$itemId", params: { itemId: item.id } })}
                onEdit={() => {
                  setEditingItem(item);
                  setDialogOpen(true);
                }}
                onDelete={() => setDeletingItem(item)}
              />
            ))}
          </div>
        )}
      </PageBody>

      <WorkspaceItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editingItem}
        isSaving={createMutation.isPending || updateMutation.isPending}
        isDelegating={delegateMutation.isPending}
        onCreate={(input) =>
          createMutation.mutate(input, { onSuccess: () => setDialogOpen(false) })
        }
        onUpdate={(id, input) =>
          updateMutation.mutate({ id, body: input }, { onSuccess: () => setDialogOpen(false) })
        }
        onDelegate={(id, ownerId) =>
          delegateMutation.mutate({ id, ownerId }, { onSuccess: () => setDialogOpen(false) })
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

const PRIORITY_TONE: Record<WorkspacePriority, "neutral" | "info" | "warning"> = {
  LOW: "neutral",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "warning",
};

function AssignedItemRow({
  item,
  onClick,
  onEdit,
  onDelete,
}: {
  item: WorkspaceItem;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card
      className="cursor-pointer p-4 transition-all hover:border-foreground/20 hover:shadow-sm"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-medium text-foreground">{item.title}</span>
            <Badge>{workspaceStatusLabel(item.status)}</Badge>
            <Badge tone={PRIORITY_TONE[item.priority]}>
              {workspacePriorityLabel(item.priority)}
            </Badge>
            <Badge>{workspaceSourceLabel(item.source)}</Badge>
            {item.isClientProject && <Badge tone="success">Client</Badge>}
          </div>
          {item.description && (
            <p className="mt-1.5 text-[12px] text-muted-foreground line-clamp-1">
              {item.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Avatar
              initials={userInitials(item.owner.firstName, item.owner.lastName)}
              color={avatarColor(item.owner.id)}
              size="xs"
              src={item.owner.avatarUrl}
            />
            In {fullName(item.owner.firstName, item.owner.lastName)}'s workspace
            {item.dueDate && <span>· Due {fmtDate(item.dueDate)}</span>}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-rose-600 dark:text-rose-400">
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
