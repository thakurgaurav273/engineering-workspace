"use client";
import { usePeople } from "@/applications/engineering/hooks/use-org-members";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { fullName } from "@grovyn/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@grovyn/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@grovyn/ui/components/select";
import { Checkbox } from "@grovyn/ui/components/checkbox";
import { Textarea } from "@grovyn/ui/components/textarea";
import { Button } from "@grovyn/ui/primitives";
import { useProjectMutations, useTeams } from "@/applications/engineering/hooks/use-issues";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  type Project,
  type ProjectStatus,
} from "@/applications/engineering/lib/issues";

const NO_LEAD = "__none__";

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] outline-none focus:border-foreground/30 [color-scheme:light] dark:[color-scheme:dark]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11.5px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/** Create (no `project`) or edit a project. */
export function ProjectDialog({
  open,
  onOpenChange,
  project,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
  onCreated?: (project: Project) => void;
}) {
  const { data: teams = [] } = useTeams();
  const people = usePeople(open);
  const { create, update } = useProjectMutations();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("PLANNED");
  const [leadId, setLeadId] = useState<string>(NO_LEAD);
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [teamIds, setTeamIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(project?.name ?? "");
    setDescription(project?.description ?? "");
    setStatus(project?.status ?? "PLANNED");
    setLeadId(project?.leadId ?? NO_LEAD);
    setStartDate(project?.startDate?.slice(0, 10) ?? "");
    setTargetDate(project?.targetDate?.slice(0, 10) ?? "");
    setTeamIds(project?.teams.map((t) => t.id) ?? []);
  }, [open, project]);

  const pending = create.isPending || update.isPending;
  const datesInvalid = !!startDate && !!targetDate && targetDate < startDate;
  const canSubmit = name.trim().length > 0 && !datesInvalid && !pending;

  const submit = () => {
    if (!canSubmit) return;
    const body = {
      name: name.trim(),
      description: description.trim(),
      status,
      leadId: leadId === NO_LEAD ? null : leadId,
      startDate: startDate ? new Date(startDate).toISOString() : null,
      targetDate: targetDate ? new Date(targetDate).toISOString() : null,
      teamIds,
    };
    if (project) {
      update.mutate({ id: project.id, ...body }, { onSuccess: () => onOpenChange(false) });
    } else {
      create.mutate(body, {
        onSuccess: (created) => {
          onOpenChange(false);
          onCreated?.(created);
        },
      });
    }
  };

  const toggleTeam = (id: string) =>
    setTeamIds((ids) => (ids.includes(id) ? ids.filter((t) => t !== id) : [...ids, id]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5">
          <Field label="Name">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="e.g. Billing v2"
              className={inputClass}
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="What is this project about?"
              className="text-[13px]"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Status">
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {PROJECT_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Lead">
              <Select value={leadId} onValueChange={setLeadId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_LEAD}>No lead</SelectItem>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {fullName(p.firstName, p.lastName)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Start date">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Target date">
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          {datesInvalid && (
            <p className="text-[12px] text-rose-600 dark:text-rose-400">
              Target date must be after the start date.
            </p>
          )}
          {teams.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11.5px] font-medium text-muted-foreground">Teams</span>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {teams.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-[12.5px]">
                    <Checkbox
                      checked={teamIds.includes(t.id)}
                      onCheckedChange={() => toggleTeam(t.id)}
                    />
                    <span className="font-mono-num text-muted-foreground">{t.key}</span> {t.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {project ? "Save" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
