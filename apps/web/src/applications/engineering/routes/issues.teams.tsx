import Link from "next/link";
import { usePeople } from "@/applications/engineering/hooks/use-org-members";
import { useState } from "react";
import { AppShell } from "@/platform/shell/app-shell";
import {
  PageHeader,
  PageBody,
  Button,
  Card,
  CardHeader,
  Badge,
  EmptyState,
  Skeleton,
} from "@grovyn/ui/primitives";
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
import { Switch } from "@grovyn/ui/components/switch";
import {
  useTeams,
  useTeam,
  useTeamMutations,
  useLabels,
  useLabelMutations,
} from "@/applications/engineering/hooks/use-issues";
import { IssuesNav } from "@/applications/engineering/components/issues/issue-views";
import { PersonAvatar } from "@/applications/engineering/components/issues/issue-ui";
import { WorkflowCard } from "@/applications/engineering/components/issues/workflow-card";
import { getStoredAuth } from "@/platform/auth/auth";
import { fullName } from "@grovyn/utils";
import type { IssueLabel, TeamRole } from "@/applications/engineering/lib/issues";
import {
  Archive as ArchiveIcon,
  ArrowRight,
  Check,
  Plus,
  RotateCcw,
  Trash2,
  Users,
  X,
} from "lucide-react";

const LABEL_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#6b7280",
];

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40";

// Suggests a key from the team name ("Platform Team" -> "PT"), the way Linear does.
function suggestKey(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? "").slice(0, 3);
  return letters
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
}

function CreateTeamDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const { create } = useTeamMutations();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState("");

  const canSubmit = name.trim().length >= 2 && /^[A-Z0-9]{2,10}$/.test(key);

  const reset = () => {
    setName("");
    setKey("");
    setKeyTouched(false);
    setDescription("");
  };

  const submit = () => {
    if (!canSubmit || create.isPending) return;
    create.mutate(
      { name: name.trim(), key, description: description.trim() || undefined },
      {
        onSuccess: (team) => {
          reset();
          onOpenChange(false);
          onCreated(team.id);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New team</DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!keyTouched) setKey(suggestKey(e.target.value));
              }}
              placeholder="e.g. Platform"
              maxLength={80}
              className={`mt-1.5 ${inputClass}`}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Key
            </label>
            <input
              value={key}
              onChange={(e) => {
                setKeyTouched(true);
                setKey(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 10),
                );
              }}
              placeholder="PLT"
              className={`mt-1.5 font-mono-num ${inputClass}`}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              2-10 letters or digits, unique in your organization. Issues are numbered{" "}
              {key || "KEY"}-1, {key || "KEY"}-2, …
            </p>
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
              className={`mt-1.5 ${inputClass}`}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit || create.isPending}>
            {create.isPending ? "Creating…" : "Create team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TeamDetailPanel({ teamId, isAdmin }: { teamId: string; isAdmin: boolean }) {
  const me = getStoredAuth()?.user;
  const { data: team, isLoading } = useTeam(teamId);
  const { archive, addMember, removeMember } = useTeamMutations();
  const people = usePeople();

  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState<TeamRole>("MEMBER");

  if (isLoading || !team) {
    return (
      <Card>
        <div className="space-y-3 p-5">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-20 w-full rounded-md" />
        </div>
      </Card>
    );
  }

  const archived = !!team.archivedAt;
  const myMembership = team.members.find((m) => m.userId === me?.id);
  const canManage = isAdmin || myMembership?.role === "LEAD";
  const memberIds = new Set(team.members.map((m) => m.userId));
  const candidates = people.filter((p) => !memberIds.has(p.id));

  const add = () => {
    if (!newUserId) return;
    addMember.mutate(
      { id: team.id, userId: newUserId, role: newRole },
      {
        onSuccess: () => {
          setNewUserId("");
          setNewRole("MEMBER");
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader
        title={`${team.name} (${team.key})`}
        subtitle={team.description ?? "No description."}
        action={
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {!archived && me && !myMembership && (
              <Button
                variant="secondary"
                size="sm"
                disabled={addMember.isPending}
                onClick={() => addMember.mutate({ id: team.id, userId: me.id })}
              >
                <Plus className="h-3.5 w-3.5" /> Join team
              </Button>
            )}
            {isAdmin && (
              <Button
                variant="secondary"
                size="sm"
                disabled={archive.isPending}
                onClick={() => archive.mutate({ id: team.id, archived: !archived })}
              >
                {archived ? (
                  <>
                    <RotateCcw className="h-3.5 w-3.5" /> Restore
                  </>
                ) : (
                  <>
                    <ArchiveIcon className="h-3.5 w-3.5" /> Archive
                  </>
                )}
              </Button>
            )}
          </div>
        }
      />
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {team.members.length} member{team.members.length === 1 ? "" : "s"}
          {archived && <Badge tone="warning">Archived</Badge>}
          {!archived && (
            <Link
              href={`/issues?team=${team.id}`}
              className="ml-auto inline-flex items-center gap-1 text-foreground hover:underline"
            >
              View issues <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        <ul className="divide-y divide-border rounded-md border border-border">
          {team.members.map((m) => {
            const isMe = m.userId === me?.id;
            const canRemove = canManage || isMe;
            return (
              <li key={m.id} className="flex items-center gap-2.5 px-3 py-2">
                <PersonAvatar person={m.user} size="sm" />
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {fullName(m.user.firstName, m.user.lastName)}
                  {isMe && <span className="text-muted-foreground"> (you)</span>}
                </span>
                {canManage && !archived ? (
                  <Select
                    value={m.role}
                    onValueChange={(role) =>
                      addMember.mutate({ id: team.id, userId: m.userId, role: role as TeamRole })
                    }
                  >
                    <SelectTrigger className="h-7 w-[100px] text-[12px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">Member</SelectItem>
                      <SelectItem value="LEAD">Lead</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge tone={m.role === "LEAD" ? "info" : "neutral"}>
                    {m.role === "LEAD" ? "Lead" : "Member"}
                  </Badge>
                )}
                {canRemove && (
                  <button
                    type="button"
                    aria-label={isMe ? "Leave team" : `Remove ${m.user.firstName}`}
                    title={isMe ? "Leave team" : "Remove from team"}
                    disabled={removeMember.isPending}
                    onClick={() => removeMember.mutate({ id: team.id, userId: m.userId })}
                    className="rounded p-1 text-muted-foreground hover:bg-surface hover:text-foreground"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {canManage && !archived && (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={newUserId} onValueChange={setNewUserId}>
              <SelectTrigger className="min-w-[180px] flex-1">
                <SelectValue placeholder="Add a teammate" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {fullName(p.firstName, p.lastName)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={newRole} onValueChange={(v) => setNewRole(v as TeamRole)}>
              <SelectTrigger className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MEMBER">Member</SelectItem>
                <SelectItem value="LEAD">Lead</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={add} disabled={!newUserId || addMember.isPending}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function ColorSwatches({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {LABEL_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Color ${c}`}
          onClick={() => onChange(c)}
          className={`h-5 w-5 rounded-full border-2 ${value === c ? "border-foreground" : "border-transparent"}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

function LabelRow({ label, scope }: { label: IssueLabel; scope: string }) {
  const { update, remove } = useLabelMutations();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState(label.color);

  if (editing) {
    return (
      <li className="space-y-2 px-3 py-2.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          className={inputClass}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ColorSwatches value={color} onChange={setColor} />
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              disabled={!name.trim() || update.isPending}
              onClick={() =>
                update.mutate(
                  { id: label.id, name: name.trim(), color },
                  { onSuccess: () => setEditing(false) },
                )
              }
            >
              <Check className="h-3.5 w-3.5" /> Save
            </Button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2.5 px-3 py-2">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: label.color }}
      />
      <button
        type="button"
        onClick={() => {
          setName(label.name);
          setColor(label.color);
          setEditing(true);
        }}
        className="min-w-0 flex-1 truncate text-left text-[13px] hover:underline"
        title="Edit label"
      >
        {label.name}
      </button>
      <span className="text-[11px] text-muted-foreground">{scope}</span>
      <button
        type="button"
        aria-label={`Delete ${label.name}`}
        disabled={remove.isPending}
        onClick={() => remove.mutate(label.id)}
        className="rounded p-1 text-muted-foreground hover:bg-surface hover:text-foreground"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function LabelsCard({ team }: { team: { id: string; key: string } | null }) {
  const { data: labels, isLoading } = useLabels(team?.id);
  const { create } = useLabelMutations();
  const [name, setName] = useState("");
  const [color, setColor] = useState(LABEL_COLORS[5]);
  const [scope, setScope] = useState<"workspace" | "team">("workspace");

  const submit = () => {
    if (!name.trim() || create.isPending) return;
    create.mutate(
      { name: name.trim(), color, teamId: scope === "team" && team ? team.id : undefined },
      { onSuccess: () => setName("") },
    );
  };

  return (
    <Card>
      <CardHeader
        title="Labels"
        subtitle={
          team
            ? `Workspace labels plus ${team.key}'s own. Click a label to rename or recolor it.`
            : "Workspace labels, available to every team."
        }
      />
      <div className="space-y-3 p-5">
        {isLoading ? (
          <Skeleton className="h-16 w-full rounded-md" />
        ) : labels?.length ? (
          <ul className="divide-y divide-border rounded-md border border-border">
            {labels.map((l) => (
              <LabelRow
                key={l.id}
                label={l}
                scope={l.teamId ? (team?.key ?? "Team") : "Workspace"}
              />
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-muted-foreground">No labels yet.</p>
        )}

        <div className="space-y-2 rounded-md border border-dashed border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="New label name"
              maxLength={40}
              className={`min-w-[160px] flex-1 ${inputClass}`}
            />
            {team && (
              <Select value={scope} onValueChange={(v) => setScope(v as "workspace" | "team")}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="workspace">Workspace</SelectItem>
                  <SelectItem value="team">{team.key} only</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button onClick={submit} disabled={!name.trim() || create.isPending}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
          <ColorSwatches value={color} onChange={setColor} />
        </div>
      </div>
    </Card>
  );
}

export function IssueTeamsPage() {
  const me = getStoredAuth()?.user;
  const isAdmin = me?.role === "OWNER" || me?.role === "ADMIN";
  const [showArchived, setShowArchived] = useState(false);
  const { data: teams, isLoading } = useTeams(showArchived);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Fall back to the first team until the user picks one (or after the picked team is
  // archived out of the list).
  const activeTeam = teams?.find((t) => t.id === selectedId) ?? teams?.[0] ?? null;

  return (
    <AppShell>
      <PageHeader
        title="Teams"
        description="Every issue belongs to a team. Team leads manage their own roster; anyone can join a team."
        actions={
          isAdmin ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New team
            </Button>
          ) : undefined
        }
      />
      <PageBody className="space-y-4">
        <IssuesNav />

        {isAdmin && (
          <label className="flex w-fit items-center gap-2 text-[12px] text-muted-foreground">
            <Switch checked={showArchived} onCheckedChange={setShowArchived} /> Show archived
          </label>
        )}

        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : !teams?.length ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="No teams yet"
            description={
              isAdmin
                ? "Create a team (e.g. Engineering, key ENG), add its members, then start filing issues."
                : "An admin hasn't created any teams yet."
            }
            action={
              isAdmin ? (
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> New team
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
            <ul className="space-y-1.5">
              {teams.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    aria-current={t.id === activeTeam?.id}
                    className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-[13px] ${
                      t.id === activeTeam?.id
                        ? "border-foreground/30 bg-surface"
                        : "border-border hover:bg-surface/60"
                    } ${t.archivedAt ? "opacity-60" : ""}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{t.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {t.memberCount} member{t.memberCount === 1 ? "" : "s"} · {t.openIssueCount}{" "}
                        open
                        {t.myRole && ` · ${t.myRole === "LEAD" ? "Lead" : "Joined"}`}
                      </span>
                    </span>
                    <Badge>{t.key}</Badge>
                  </button>
                </li>
              ))}
            </ul>
            {activeTeam && (
              <div className="space-y-4">
                <TeamDetailPanel key={activeTeam.id} teamId={activeTeam.id} isAdmin={isAdmin} />
                <WorkflowCard
                  key={`${activeTeam.id}-workflow`}
                  team={activeTeam}
                  canManage={isAdmin || activeTeam.myRole === "LEAD"}
                />
                <LabelsCard key={`${activeTeam.id}-labels`} team={activeTeam} />
              </div>
            )}
          </div>
        )}
      </PageBody>

      <CreateTeamDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={setSelectedId} />
    </AppShell>
  );
}
