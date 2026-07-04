import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button, Kbd } from "@/components/primitives";
import { api, type Paginated } from "@/lib/api";
import { isAuthenticated, getStoredAuth } from "@/lib/auth";
import {
  workspacePriorityLabel,
  workspaceSourceLabel,
  type WorkspaceItem,
  type WorkspacePriority,
  type WorkspaceSource,
  type CreateWorkspaceItemInput,
  type UpdateWorkspaceItemInput,
} from "@/lib/workspace";

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
  isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: WorkspaceItem | null;
  onCreate: (input: CreateWorkspaceItemInput) => void;
  onUpdate: (id: string, input: UpdateWorkspaceItemInput) => void;
  isSaving?: boolean;
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

  const { data: members } = useQuery<Paginated<OrgMember>>({
    queryKey: ["people", "for-workspace-assignee"],
    queryFn: () => api.get("/people?limit=100"),
    enabled: isAuthenticated() && open && !isEdit,
  });

  const assignableMembers = (members?.data ?? []).filter(
    (m) => m.id === me?.id || isAdmin || m.managerId === me?.id,
  );

  useEffect(() => {
    if (!open) return;
    if (item) {
      setTitle(item.title);
      setDescription(item.description ?? "");
      setPriority(item.priority);
      setSource(item.source);
      setDueDate(toDateInputValue(item.dueDate));
      setOwnerId(item.ownerId);
    } else {
      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      setSource("MANUAL");
      setDueDate("");
      setOwnerId(me?.id ?? "");
    }
    setTimeout(() => titleRef.current?.focus(), 50);
  }, [open, item, me?.id]);

  const canSubmit = title.trim().length >= 2;

  const handleSubmit = () => {
    if (!canSubmit || isSaving) return;
    if (isEdit && item) {
      onUpdate(item.id, {
        title,
        description: description || undefined,
        priority,
        source,
        dueDate: dueDate ? dueDate : null,
      });
    } else {
      onCreate({
        title,
        description: description || undefined,
        priority,
        source,
        dueDate: dueDate || undefined,
        ownerId: ownerId !== me?.id ? ownerId : undefined,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
              Notes <span className="normal-case font-normal">(markdown supported)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional details…"
              className="mt-1.5 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
            />
          </div>

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
