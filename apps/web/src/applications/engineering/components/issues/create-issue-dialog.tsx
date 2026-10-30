"use client";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@grovyn/ui/components/dialog";
import { Button, Kbd } from "@grovyn/ui/primitives";
import { MarkdownEditor } from "@grovyn/ui/markdown-editor";
import { Switch } from "@grovyn/ui/components/switch";
import { useOrgMembers } from "@/applications/engineering/hooks/use-org-members";
import {
  useCreateIssue,
  useCycles,
  useLabels,
  useProjects,
  useStates,
  useTeams,
} from "@/applications/engineering/hooks/use-issues";
import {
  sortStates,
  type IssuePriority,
  type IssueState,
  type IssueStateCategory,
  type Person,
} from "@/applications/engineering/lib/issues";
import {
  AssigneePicker,
  CyclePicker,
  DueDateInput,
  LabelChip,
  LabelsPicker,
  PriorityPicker,
  ProjectPicker,
  PropertyButton,
  StatusPicker,
} from "./issue-ui";

export interface CreateIssueDefaults {
  teamId?: string;
  /** A specific status of `teamId`... */
  stateId?: string;
  /** ...or the first status of this category in whichever team is picked. */
  category?: IssueStateCategory;
  assigneeId?: string | null;
  projectId?: string | null;
  cycleId?: string | null;
  parentId?: string | null;
  parentLabel?: string;
}

const LAST_TEAM_KEY = "grovyn_issues_last_team";

function readLastTeam(): string | null {
  try {
    return localStorage.getItem(LAST_TEAM_KEY);
  } catch {
    return null;
  }
}

/** Linear's "New issue" modal: title, description and a row of property pickers. */
export function CreateIssueDialog({
  open,
  onOpenChange,
  defaults,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults?: CreateIssueDefaults;
}) {
  const { data: teams = [] } = useTeams();
  const { data: membersPage } = useOrgMembers(open);
  const people: Person[] = (membersPage?.data ?? []).map((m) => ({
    id: m.id,
    firstName: m.firstName,
    lastName: m.lastName,
    avatarUrl: m.avatarUrl ?? null,
  }));

  const [teamId, setTeamId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // null = "the team's default"; resolved once the team's statuses load.
  const [stateId, setStateId] = useState<string | null>(null);
  const [priority, setPriority] = useState<IssuePriority>("NONE");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [createMore, setCreateMore] = useState(false);
  // Remounts the editor so "create more" starts from an empty description.
  const [editorKey, setEditorKey] = useState(0);

  const { data: labels = [] } = useLabels(teamId || undefined);
  const { data: projects = [] } = useProjects();
  const { data: cycles = [] } = useCycles(teamId || null);
  const { data: teamStates = [] } = useStates(teamId || null, !!teamId);
  const state = useMemo<IssueState | null>(() => {
    const ordered = sortStates(teamStates);
    return (
      ordered.find((s) => s.id === stateId) ??
      (defaults?.category && ordered.find((s) => s.category === defaults.category)) ??
      ordered.find((s) => s.category === "UNSTARTED") ??
      ordered[0] ??
      null
    );
  }, [teamStates, stateId, defaults?.category]);
  const create = useCreateIssue();

  const reset = () => {
    setTitle("");
    setDescription("");
    setEditorKey((k) => k + 1);
  };

  useEffect(() => {
    if (!open) return;
    reset();
    const myTeams = teams.filter((t) => t.myRole);
    const fallback = [readLastTeam(), myTeams[0]?.id, teams[0]?.id].find(
      (id) => id && teams.some((t) => t.id === id),
    );
    setTeamId(defaults?.teamId ?? fallback ?? "");
    setStateId(defaults?.stateId ?? null);
    setPriority("NONE");
    setAssigneeId(defaults?.assigneeId ?? null);
    setProjectId(defaults?.projectId ?? null);
    setCycleId(defaults?.cycleId ?? null);
    setLabelIds([]);
    setDueDate(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // First load: teams may arrive after the dialog opened.
  useEffect(() => {
    if (open && !teamId && teams.length) setTeamId(teams.find((t) => t.myRole)?.id ?? teams[0].id);
  }, [open, teamId, teams]);

  const changeTeam = (id: string) => {
    setTeamId(id);
    // Statuses, cycles and team labels don't carry across teams.
    setStateId(null);
    setCycleId(null);
    setLabelIds((ids) => ids.filter((lid) => labels.find((l) => l.id === lid)?.teamId == null));
  };

  const selectedLabels = useMemo(
    () => labels.filter((l) => labelIds.includes(l.id)),
    [labels, labelIds],
  );
  const team = teams.find((t) => t.id === teamId);
  const canSubmit = !!teamId && title.trim().length > 0 && !create.isPending;

  const submit = () => {
    if (!canSubmit) return;
    create.mutate(
      {
        teamId,
        title: title.trim(),
        description: description.trim() || undefined,
        stateId: state?.id,
        priority,
        assigneeId,
        projectId,
        cycleId,
        labelIds,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        parentId: defaults?.parentId ?? null,
      },
      {
        onSuccess: () => {
          try {
            localStorage.setItem(LAST_TEAM_KEY, teamId);
          } catch {
            /* storage unavailable */
          }
          if (createMore) reset();
          else onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[13px] font-medium">
            <select
              value={teamId}
              onChange={(e) => changeTeam(e.target.value)}
              className="rounded-md border border-border bg-surface px-2 py-1 text-[12px] outline-none"
              aria-label="Team"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.key} · {t.name}
                </option>
              ))}
            </select>
            <span className="text-muted-foreground">›</span>
            <span>
              {defaults?.parentLabel ? `New sub-issue of ${defaults.parentLabel}` : "New issue"}
            </span>
          </DialogTitle>
        </DialogHeader>

        {teams.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">
            Create a team first (Issues → Teams) - every issue belongs to one.
          </p>
        ) : (
          <div className="space-y-3">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Issue title"
              maxLength={255}
              className="w-full bg-transparent text-[18px] font-semibold tracking-tight outline-none placeholder:text-muted-foreground/60"
            />
            <div className="rounded-md border border-border px-3 py-2">
              <MarkdownEditor
                key={editorKey}
                value={description}
                onChange={setDescription}
                placeholder="Add description…"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPicker teamId={teamId} value={state} onChange={(s) => setStateId(s.id)} />
              <PriorityPicker value={priority} onChange={setPriority} />
              <AssigneePicker
                value={people.find((p) => p.id === assigneeId) ?? null}
                people={people}
                onChange={setAssigneeId}
              />
              <LabelsPicker teamId={teamId || undefined} value={labelIds} onChange={setLabelIds} />
              <ProjectPicker
                value={projects.find((p) => p.id === projectId) ?? null}
                onChange={setProjectId}
              />
              {cycles.length > 0 && (
                <CyclePicker
                  value={cycles.find((c) => c.id === cycleId) ?? null}
                  cycles={cycles}
                  onChange={setCycleId}
                />
              )}
              <DueDateInput value={dueDate} onChange={setDueDate} />
              {team && (
                <PropertyButton disabled className="text-muted-foreground">
                  {team.key}-…
                </PropertyButton>
              )}
            </div>
            {selectedLabels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedLabels.map((l) => (
                  <LabelChip
                    key={l.id}
                    label={l}
                    onRemove={() => setLabelIds(labelIds.filter((id) => id !== l.id))}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="hidden text-[11.5px] text-muted-foreground sm:inline">
            <Kbd>Enter</Kbd> to create <Kbd>Esc</Kbd> to cancel
          </span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <Switch checked={createMore} onCheckedChange={setCreateMore} /> Create more
            </label>
            <Button onClick={submit} disabled={!canSubmit}>
              {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create issue
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
