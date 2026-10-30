import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@grovyn/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@grovyn/ui/components/select";
import { Checkbox } from "@grovyn/ui/components/checkbox";
import { Button, Kbd, Badge } from "@grovyn/ui/primitives";
import { MarkdownEditor } from "@grovyn/ui/markdown-editor";
import { api, type Paginated } from "@/shared/lib/api";
import { isAuthenticated, getStoredAuth } from "@/platform/auth/auth";
import {
  workspacePriorityLabel,
  workspaceSourceLabel,
  type WorkspaceItem,
  type WorkspacePriority,
  type WorkspaceSource,
  type CreateWorkspaceItemInput,
  type UpdateWorkspaceItemInput,
} from "@/applications/engineering/lib/workspace";
import { useTeams } from "@/applications/engineering/hooks/use-teams";
import { UserPlus } from "lucide-react";

// Radix Select can't hold an empty string, so "no team" gets a sentinel value.
const NO_TEAM = "none";

const PRIORITIES: WorkspacePriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const SOURCES: WorkspaceSource[] = [
  "MANUAL",
  "LINEAR",
  "SLACK",
  "WHATSAPP",
  "EMAIL",
  "MEETING",
  "PHONE_CALL",
  "OTHER",
];

interface OrgMember {
  id: string;
  firstName: string;
  lastName: string;
  managerId?: string | null;
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function WorkspaceItemDialog({
  open,
  onOpenChange,
  item,
  onCreate,
  onUpdate,
  onDelegate,
  isSaving,
  isDelegating,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: WorkspaceItem | null;
  onCreate: (input: CreateWorkspaceItemInput) => void;
  onUpdate: (id: string, input: UpdateWorkspaceItemInput) => void;
  onDelegate?: (id: string, ownerId: string) => void;
  isSaving?: boolean;
  isDelegating?: boolean;
}) {
  const isEdit = !!item;
  const me = getStoredAuth()?.user;
  const isAdmin = me?.role === "OWNER" || me?.role === "ADMIN";
  const titleRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<WorkspacePriority>("MEDIUM");
  const [source, setSource] = useState<WorkspaceSource>("MANUAL");
  const [dueDate, setDueDate] = useState("");
  const [ownerId, setOwnerId] = useState<string>(me?.id ?? "");
  const [isClientProject, setIsClientProject] = useState(false);
  const [delegateToId, setDelegateToId] = useState<string>("");
  const [teamId, setTeamId] = useState<string>(NO_TEAM);
  const { data: teams } = useTeams(open);

  const { data: members } = useQuery<Paginated<OrgMember>>({
    queryKey: ["people", "for-workspace-assignee"],
    queryFn: () => api.get("/people?limit=100"),
    enabled: isAuthenticated() && open,
  });

  // Matches the backend's assertCanAssign: OWNER/ADMIN can hand off to anyone, everyone
  // else only to their own direct reports.
  const assignableMembers = (members?.data ?? []).filter(
    (m) => m.id === me?.id || isAdmin || m.managerId === me?.id,
  );
  // Delegation isn't limited to direct reports - whoever owns the item can hand it
  // off to any active teammate, matching the backend's delegate() endpoint.
  const delegateTargets = (members?.data ?? []).filter((m) => m.id !== item?.ownerId);
  const canDelegate =
    isEdit &&
    !!onDelegate &&
    !!item &&
    (item.ownerId === me?.id || isAdmin) &&
    delegateTargets.length > 0;

  useEffect(() => {
    if (!open) return;
    if (item) {
      setTitle(item.title);
      setDescription(item.description ?? "");
      setPriority(item.priority);
      setSource(item.source);
      setDueDate(toDateInputValue(item.dueDate));
      setOwnerId(item.ownerId);
      setIsClientProject(item.isClientProject);
      setTeamId(item.teamId ?? NO_TEAM);
    } else {
      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      setSource("MANUAL");
      setDueDate("");
      setOwnerId(me?.id ?? "");
      setIsClientProject(false);
      setTeamId(NO_TEAM);
    }
    setDelegateToId("");
    setTimeout(() => titleRef.current?.focus(), 50);
  }, [open, item, me?.id]);

  const canSubmit = title.trim().length >= 2;

  // When an item was assigned by someone else, only that assigner (or an admin) may move
  // the due date. The assignee can still edit everything else, but the date is locked.
  const assignedByOther = isEdit && !!item?.assignedById;
  const canEditDueDate = !assignedByOther || item?.assignedById === me?.id || isAdmin;

  const handleSubmit = () => {
    if (!canSubmit || isSaving) return;
    if (isEdit && item) {
      onUpdate(item.id, {
        title,
        description: description || undefined,
        priority,
        source,
        // Omit dueDate when locked so an assignee editing other fields doesn't get rejected.
        ...(canEditDueDate && { dueDate: dueDate ? dueDate : null }),
        isClientProject,
        // The API re-checks team membership whenever teamId is sent, so only send it
        // when it actually changed - otherwise editing an item in a team you can't
        // file work under would fail on an unchanged field.
        ...(teamId !== (item.teamId ?? NO_TEAM) && {
          teamId: teamId === NO_TEAM ? null : teamId,
        }),
      });
    } else {
      onCreate({
        title,
        description: description || undefined,
        priority,
        source,
        dueDate: dueDate || undefined,
        ownerId: ownerId !== me?.id ? ownerId : undefined,
        isClientProject,
        teamId: teamId !== NO_TEAM ? teamId : undefined,
      });
    }
  };

  const handleDelegate = () => {
    if (!item || !delegateToId || !onDelegate) return;
    onDelegate(item.id, delegateToId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit action item" : "New action item"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3.5">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Title
            </label>
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="e.g. Call client tomorrow"
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Notes
            </label>
            <div className="mt-1.5">
              <MarkdownEditor value={description} onChange={setDescription} />
            </div>
          </div>

          <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2.5 cursor-pointer">
            <Checkbox checked={isClientProject} onCheckedChange={(v) => setIsClientProject(!!v)} />
            <div className="min-w-0">
              <div className="text-[12.5px] font-medium">Client Project</div>
              <div className="text-[11px] text-muted-foreground">
                Helps the assignee prioritize this item
              </div>
            </div>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Priority
              </label>
              <Select value={priority} onValueChange={(v) => setPriority(v as WorkspacePriority)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {workspacePriorityLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Due date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Source
              </label>
              <Select value={source} onValueChange={(v) => setSource(v as WorkspaceSource)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {workspaceSourceLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!isEdit && assignableMembers.length > 1 && (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Assign to
                </label>
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.id === me?.id ? "Myself" : `${m.firstName} ${m.lastName}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {!!teams?.length && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Team
              </label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEAM}>No team</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.key})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {canDelegate && (
            <div className="rounded-md border border-dashed border-border p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <UserPlus className="h-3.5 w-3.5" /> Delegate this item
              </div>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                Hand this off to a teammate. You
                {item?.assignedBy ? " and whoever assigned it to you" : ""} will keep getting
                notified when they update it.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Select value={delegateToId} onValueChange={setDelegateToId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Choose a teammate" />
                  </SelectTrigger>
                  <SelectContent>
                    {delegateTargets.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.firstName} {m.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="secondary"
                  onClick={handleDelegate}
                  disabled={!delegateToId || isDelegating}
                >
                  {isDelegating ? "Delegating…" : "Delegate"}
                </Button>
              </div>
              {item?.watcherIds && item.watcherIds.length > 0 && (
                <div className="mt-2">
                  <Badge>
                    {item.watcherIds.length} watcher{item.watcherIds.length === 1 ? "" : "s"}{" "}
                    already in the loop
                  </Badge>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="hidden text-[11px] text-muted-foreground sm:flex items-center gap-1">
            <Kbd>Enter</Kbd> to save <Kbd>Esc</Kbd> to cancel
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit || isSaving}>
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
