import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/platform/shell/app-shell";
import {
  PageHeader,
  PageBody,
  Button,
  Card,
  CardHeader,
  Avatar,
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
import {
  useTeams,
  useTeam,
  useTeamItems,
  useCreateTeam,
  useArchiveTeam,
  useAddTeamMember,
  useRemoveTeamMember,
} from "@/applications/engineering/hooks/use-teams";
import { useOrgMembers } from "@/applications/engineering/hooks/use-org-members";
import { getStoredAuth } from "@/platform/auth/auth";
import { avatarColor, userInitials, fullName } from "@grovyn/utils";
import { workspaceStatusLabel, type TeamRole } from "@/applications/engineering/lib/workspace";
import { ArrowLeft, Archive as ArchiveIcon, Plus, Trash2, Users } from "lucide-react";

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
  const createMutation = useCreateTeam();
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
    if (!canSubmit || createMutation.isPending) return;
    createMutation.mutate(
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
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
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
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 font-mono-num text-[13px] outline-none focus:border-foreground/40"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              2-10 letters or digits, unique in your organization.
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
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit || createMutation.isPending}>
            {createMutation.isPending ? "Creating…" : "Create team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TeamDetailPanel({ teamId, isAdmin }: { teamId: string; isAdmin: boolean }) {
  const me = getStoredAuth()?.user;
  const { data: team, isLoading } = useTeam(teamId);
  const archiveMutation = useArchiveTeam();
  const addMember = useAddTeamMember(teamId);
  const removeMember = useRemoveTeamMember(teamId);
  const { data: orgMembers } = useOrgMembers();

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

  const myMembership = team.members.find((m) => m.userId === me?.id);
  const canManage = isAdmin || myMembership?.role === "LEAD";
  const memberIds = new Set(team.members.map((m) => m.userId));
  const candidates = (orgMembers?.data ?? []).filter((m) => !memberIds.has(m.id));

  const add = () => {
    if (!newUserId) return;
    addMember.mutate(
      { userId: newUserId, role: newRole },
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
          isAdmin && !team.archivedAt ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={archiveMutation.isPending}
              onClick={() => archiveMutation.mutate(team.id)}
            >
              <ArchiveIcon className="h-3.5 w-3.5" /> Archive
            </Button>
          ) : undefined
        }
      />
      <div className="space-y-4 p-5">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {team.members.length} member{team.members.length === 1 ? "" : "s"} ·{" "}
          {team._count?.items ?? 0} item{team._count?.items === 1 ? "" : "s"} incl. sub-issues
          {team.archivedAt && <Badge tone="warning">Archived</Badge>}
        </div>

        <ul className="divide-y divide-border rounded-md border border-border">
          {team.members.map((m) => {
            const isMe = m.userId === me?.id;
            const canRemove = canManage || isMe;
            return (
              <li key={m.id} className="flex items-center gap-2.5 px-3 py-2">
                <Avatar
                  initials={userInitials(m.user.firstName, m.user.lastName)}
                  color={avatarColor(m.user.id)}
                  size="sm"
                  src={m.user.avatarUrl}
                />
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {fullName(m.user.firstName, m.user.lastName)}
                  {isMe && <span className="text-muted-foreground"> (you)</span>}
                </span>
                <Badge tone={m.role === "LEAD" ? "info" : "neutral"}>
                  {m.role === "LEAD" ? "Lead" : "Member"}
                </Badge>
                {canRemove && (
                  <button
                    type="button"
                    aria-label={isMe ? "Leave team" : `Remove ${m.user.firstName}`}
                    disabled={removeMember.isPending}
                    onClick={() => removeMember.mutate(m.userId)}
                    className="rounded p-1 text-muted-foreground hover:bg-surface hover:text-foreground"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {canManage && !team.archivedAt && (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={newUserId} onValueChange={setNewUserId}>
              <SelectTrigger className="min-w-[200px] flex-1">
                <SelectValue placeholder="Add a teammate" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {fullName(m.firstName, m.lastName)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={newRole} onValueChange={(v) => setNewRole(v as TeamRole)}>
              <SelectTrigger className="w-[120px]">
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

function TeamItemsCard({ teamId }: { teamId: string }) {
  const { data, isLoading, isError } = useTeamItems(teamId, { topLevelOnly: true, limit: 50 });
  const items = data?.data ?? [];

  return (
    <Card>
      <CardHeader
        title="Team items"
        subtitle="Work filed under this team. Visible to members; only owners and assigners can edit."
      />
      <div className="p-5">
        {isLoading ? (
          <Skeleton className="h-20 w-full rounded-md" />
        ) : isError ? (
          <p className="text-[12.5px] text-muted-foreground">
            Only members of this team can see its items.
          </p>
        ) : !items.length ? (
          <p className="text-[12.5px] text-muted-foreground">
            Nothing filed under this team yet. Pick it in the Team field when creating an item.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-2.5 px-3 py-2">
                <Link
                  href={`/workspace/${item.id}`}
                  className={`min-w-0 flex-1 truncate text-[13px] hover:underline ${
                    item.status === "DONE" ? "text-muted-foreground line-through" : ""
                  }`}
                >
                  {item.title}
                </Link>
                {!!item._count?.children && (
                  <Badge>
                    {item._count.children} sub-issue{item._count.children === 1 ? "" : "s"}
                  </Badge>
                )}
                <Badge tone={item.status === "DONE" ? "success" : "neutral"}>
                  {workspaceStatusLabel(item.status)}
                </Badge>
                <Avatar
                  initials={userInitials(item.owner.firstName, item.owner.lastName)}
                  color={avatarColor(item.owner.id)}
                  size="xs"
                  src={item.owner.avatarUrl}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

export function WorkspaceTeamsPage() {
  const me = getStoredAuth()?.user;
  const isAdmin = me?.role === "OWNER" || me?.role === "ADMIN";
  const { data: teams, isLoading } = useTeams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Fall back to the first team until the user picks one (or after the picked team is
  // archived out of the list).
  const activeId = teams?.find((t) => t.id === selectedId)?.id ?? teams?.[0]?.id ?? null;

  return (
    <AppShell>
      <PageHeader
        title="Teams"
        description="Group people and file work under a team. Team leads can manage their own roster."
        actions={
          isAdmin ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New team
            </Button>
          ) : undefined
        }
      />
      <PageBody className="space-y-4">
        <Link
          href="/workspace"
          className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to My Workspace
        </Link>

        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : !teams?.length ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="No teams yet"
            description={
              isAdmin
                ? "Create a team, add its members, then file work under it from the item dialog."
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
            <ul className="space-y-1.5">
              {teams.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    aria-current={t.id === activeId}
                    className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-[13px] ${
                      t.id === activeId
                        ? "border-foreground/30 bg-surface"
                        : "border-border hover:bg-surface/60"
                    }`}
                  >
                    <span className="min-w-0 truncate font-medium">{t.name}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Badge>{t.key}</Badge>
                      {t._count?.members ?? 0}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {activeId && (
              <div className="space-y-4">
                <TeamDetailPanel key={activeId} teamId={activeId} isAdmin={isAdmin} />
                <TeamItemsCard key={`${activeId}-items`} teamId={activeId} />
              </div>
            )}
          </div>
        )}
      </PageBody>

      <CreateTeamDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={setSelectedId} />
    </AppShell>
  );
}
