"use client";
import { type ReactNode, useState } from "react";
import Link from "next/link";
import {
  Archive as ArchiveIcon,
  ArchiveRestore,
  ArrowLeft,
  Check,
  Crown,
  LogOut,
  MoreHorizontal,
  Plus,
  Search,
  SquareKanban,
  Trash2,
  TriangleAlert,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { cn, fullName } from "@grovyn/utils";
import { AppShell } from "@/platform/shell/app-shell";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageBody,
  Skeleton,
} from "@grovyn/ui/primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@grovyn/ui/components/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@grovyn/ui/components/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@grovyn/ui/components/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@grovyn/ui/components/select";
import {
  useLabelMutations,
  useLabels,
  useTeam,
  useTeamMutations,
  useTeams,
} from "@/applications/engineering/hooks/use-issues";
import { usePeople } from "@/applications/engineering/hooks/use-org-members";
import type {
  IssueLabel,
  Person,
  Team,
  TeamDetail,
  TeamMember,
  TeamRole,
} from "@/applications/engineering/lib/issues";
import { ColorSwatches, PersonAvatar } from "@/applications/engineering/components/issues/issue-ui";
import { WorkflowCard } from "@/applications/engineering/components/issues/workflow-card";
import { MembershipButton, TeamIcon } from "@/applications/engineering/components/teams/team-ui";
import { teamPageHref } from "@/applications/engineering/lib/team-pages";
import {
  KEY_PATTERN,
  formatCreated,
  inputClass,
  normalizeKey,
  teamAccess,
} from "@/applications/engineering/lib/teams";

export type TeamSection = "general" | "members" | "workflow" | "labels";

// Each section is its own URL (/teams/:id/members …), so it can be linked to and bookmarked.
const SECTIONS: { key: TeamSection; label: string; path: string }[] = [
  { key: "general", label: "General", path: "" },
  { key: "members", label: "Members", path: "/members" },
  { key: "workflow", label: "Workflow", path: "/workflow" },
  { key: "labels", label: "Labels", path: "/labels" },
];

// ---------------------------------------------------------------- header

function TeamHeader({
  team,
  summary,
  myRole,
  isAdmin,
}: {
  team: TeamDetail;
  summary: Team | undefined;
  myRole: TeamRole | null;
  isAdmin: boolean;
}) {
  const { archive } = useTeamMutations();
  const archived = !!team.archivedAt;
  const members = team.members.length;
  return (
    <div className="border-b border-border px-4 py-5 lg:px-8">
      <Link
        href="/teams"
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Teams
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <TeamIcon team={team} size="lg" />
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[22px] font-semibold tracking-tight text-foreground">
              <span className="truncate">{team.name}</span>
              <span className="font-mono-num text-[13px] font-normal text-muted-foreground">
                {team.key}
              </span>
              {archived && <Badge tone="warning">Archived</Badge>}
            </h1>
            {team.description && (
              <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">{team.description}</p>
            )}
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {members} member{members === 1 ? "" : "s"}
              </span>
              {summary && (
                <span className="inline-flex items-center gap-1">
                  <SquareKanban className="h-3.5 w-3.5" /> {summary.openIssueCount} open issue
                  {summary.openIssueCount === 1 ? "" : "s"}
                </span>
              )}
              <span>Created {formatCreated(team.createdAt)}</span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!archived && (
            <Link href={teamPageHref("issues", team.id)}>
              <Button variant="secondary">
                <SquareKanban className="h-3.5 w-3.5" /> View issues
              </Button>
            </Link>
          )}
          <MembershipButton size="md" teamId={team.id} myRole={myRole} archived={archived} />
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" aria-label="Team actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={archive.isPending}
                  onClick={() => archive.mutate({ id: team.id, archived: !archived })}
                >
                  {archived ? (
                    <ArchiveRestore className="h-3.5 w-3.5" />
                  ) : (
                    <ArchiveIcon className="h-3.5 w-3.5" />
                  )}
                  {archived ? "Restore team" : "Archive team"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionTabs({
  teamId,
  active,
  memberCount,
}: {
  teamId: string;
  active: TeamSection;
  memberCount: number;
}) {
  return (
    <nav className="flex items-center gap-1 overflow-x-auto border-b border-border">
      {SECTIONS.map((s) => (
        <Link
          key={s.key}
          href={`/teams/${teamId}${s.path}`}
          aria-current={active === s.key ? "page" : undefined}
          className={cn(
            "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-[12.5px] font-medium transition-colors",
            active === s.key
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {s.label}
          {s.key === "members" && (
            <span className="font-mono-num text-[11px] text-muted-foreground">{memberCount}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------- general

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function GeneralSection({
  team,
  canManage,
  isAdmin,
}: {
  team: TeamDetail;
  canManage: boolean;
  isAdmin: boolean;
}) {
  const { update, archive } = useTeamMutations();
  const [name, setName] = useState(team.name);
  const [key, setKey] = useState(team.key);
  const [description, setDescription] = useState(team.description ?? "");
  const archived = !!team.archivedAt;

  const changes = {
    ...(name.trim() !== team.name && { name: name.trim() }),
    ...(key !== team.key && { key }),
    ...(description.trim() !== (team.description ?? "") && { description: description.trim() }),
  };
  const dirty = Object.keys(changes).length > 0;
  const valid = name.trim().length >= 2 && KEY_PATTERN.test(key);
  const reset = () => {
    setName(team.name);
    setKey(team.key);
    setDescription(team.description ?? "");
  };

  return (
    <div className="max-w-2xl space-y-5">
      <Card>
        <CardHeader
          title="Team details"
          subtitle={
            canManage
              ? "How the team appears across issues, projects and cycles."
              : archived
                ? "Archived teams are read-only."
                : "Only the team's leads and organization admins can edit these."
          }
        />
        <form
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (dirty && valid && !update.isPending) update.mutate({ id: team.id, ...changes });
          }}
        >
          <Field label="Team name" htmlFor="team-name">
            <input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canManage}
              maxLength={80}
              className={inputClass}
            />
          </Field>
          <Field
            label="Identifier"
            htmlFor="team-key"
            hint="2-10 letters or digits, unique in your organization. Used in every issue ID."
          >
            <input
              id="team-key"
              value={key}
              onChange={(e) => setKey(normalizeKey(e.target.value))}
              disabled={!canManage}
              className={`font-mono-num ${inputClass}`}
            />
          </Field>
          {key !== team.key && KEY_PATTERN.test(key) && (
            <p className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-800 dark:text-amber-300">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Every issue on this team is renamed when you save: {team.key}-12 becomes {key}-12.
              </span>
            </p>
          )}
          <Field label="Description" htmlFor="team-description">
            <textarea
              id="team-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canManage}
              rows={3}
              maxLength={1000}
              placeholder="What does this team work on?"
              className={inputClass}
            />
          </Field>
          {canManage && (
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={!dirty || update.isPending}
                onClick={reset}
              >
                Discard
              </Button>
              <Button type="submit" disabled={!dirty || !valid || update.isPending}>
                {update.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          )}
        </form>
      </Card>

      {isAdmin && (
        <Card className="border-rose-500/30">
          <CardHeader title="Danger zone" />
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-[13px] font-medium">
                {archived ? "Restore team" : "Archive team"}
              </div>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                {archived
                  ? "Brings the team back into pickers and lets people join it again."
                  : "Hides the team from pickers and stops new members joining. Its issues, identifiers and history are kept; you can restore it any time."}
              </p>
            </div>
            <Button
              variant="outline"
              disabled={archive.isPending}
              onClick={() => archive.mutate({ id: team.id, archived: !archived })}
              className={cn(
                "shrink-0",
                !archived && "text-rose-600 hover:text-rose-600 dark:text-rose-400",
              )}
            >
              {archived ? (
                <ArchiveRestore className="h-3.5 w-3.5" />
              ) : (
                <ArchiveIcon className="h-3.5 w-3.5" />
              )}
              {archived ? "Restore team" : "Archive team"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- members

/** Searchable people picker; stays open so several teammates can be added in a row. */
function AddMembersButton({ teamId, candidates }: { teamId: string; candidates: Person[] }) {
  const [open, setOpen] = useState(false);
  const { addMember } = useTeamMutations();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button>
          <UserPlus className="h-3.5 w-3.5" /> Add members
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Search people…" className="text-[12.5px]" />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-[12px] text-muted-foreground">
              {candidates.length ? "No one matches" : "Everyone is already on this team"}
            </CommandEmpty>
            <CommandGroup>
              {candidates.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${fullName(p.firstName, p.lastName)} ${p.id}`}
                  disabled={addMember.isPending}
                  onSelect={() =>
                    addMember.mutate({
                      id: teamId,
                      userId: p.id,
                      successMessage: `${p.firstName} added to the team`,
                    })
                  }
                  className="gap-2 text-[12.5px]"
                >
                  <PersonAvatar person={p} />
                  <span className="flex-1 truncate">{fullName(p.firstName, p.lastName)}</span>
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function MemberRow({
  member,
  teamId,
  canManage,
  isOnlyLead,
}: {
  member: TeamMember;
  teamId: string;
  canManage: boolean;
  /** This member is the team's last lead: they can't be demoted or removed. */
  isOnlyLead: boolean;
}) {
  const { me } = teamAccess(null);
  const { addMember, removeMember } = useTeamMutations();
  const isMe = member.userId === me?.id;
  const isLead = member.role === "LEAD";
  const name = fullName(member.user.firstName, member.user.lastName);

  const setRole = (role: TeamRole) =>
    addMember.mutate({
      id: teamId,
      userId: member.userId,
      role,
      successMessage: `${member.user.firstName} is now a ${role === "LEAD" ? "lead" : "member"}`,
    });
  const remove = () =>
    removeMember.mutate({
      id: teamId,
      userId: member.userId,
      successMessage: isMe ? "You left the team" : `${member.user.firstName} removed from the team`,
    });

  return (
    <div className="flex items-center gap-3 border-b border-border/60 px-4 py-2.5 text-[13px] last:border-b-0">
      <PersonAvatar person={member.user} size="sm" />
      <div className="min-w-0 flex-1 truncate">
        <Link href={`/people/${member.userId}`} className="font-medium hover:underline">
          {name}
        </Link>
        {isMe && <span className="ml-1.5 text-muted-foreground">(you)</span>}
      </div>
      <div className="w-[112px] shrink-0">
        {canManage ? (
          <Select
            value={member.role}
            onValueChange={(v) => setRole(v as TeamRole)}
            disabled={addMember.isPending}
          >
            <SelectTrigger className="h-7 text-[12px]" aria-label={`${name}'s role`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LEAD">Lead</SelectItem>
              <SelectItem value="MEMBER" disabled={isOnlyLead}>
                Member
              </SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Badge tone={isLead ? "info" : "neutral"}>{isLead ? "Lead" : "Member"}</Badge>
        )}
      </div>
      <div className="w-7 shrink-0">
        {(canManage || isMe) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={`${name} actions`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canManage &&
                (isLead ? (
                  <DropdownMenuItem disabled={isOnlyLead} onClick={() => setRole("MEMBER")}>
                    <UserMinus className="h-3.5 w-3.5" /> Make member
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setRole("LEAD")}>
                    <Crown className="h-3.5 w-3.5" /> Make lead
                  </DropdownMenuItem>
                ))}
              {canManage && <DropdownMenuSeparator />}
              <DropdownMenuItem
                disabled={isOnlyLead || removeMember.isPending}
                onClick={remove}
                className="text-rose-600 focus:text-rose-600 dark:text-rose-400"
              >
                {isMe ? <LogOut className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                {isMe ? "Leave team" : "Remove from team"}
              </DropdownMenuItem>
              {isOnlyLead && (
                <p className="px-2 pb-1.5 pt-1 text-[11px] text-muted-foreground">
                  A team keeps at least one lead.
                </p>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

function MembersSection({
  team,
  myRole,
  canManage,
}: {
  team: TeamDetail;
  myRole: TeamRole | null;
  canManage: boolean;
}) {
  const people = usePeople();
  const [query, setQuery] = useState("");
  const archived = !!team.archivedAt;
  const memberIds = new Set(team.members.map((m) => m.userId));
  const candidates = people.filter((p) => !memberIds.has(p.id));
  const leadCount = team.members.filter((m) => m.role === "LEAD").length;
  const q = query.trim().toLowerCase();
  const shown = team.members.filter(
    (m) => !q || fullName(m.user.firstName, m.user.lastName).toLowerCase().includes(q),
  );

  return (
    <div className="max-w-3xl space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="flex h-8 w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 text-muted-foreground focus-within:border-foreground/40 sm:w-64">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter members"
            className="w-full bg-transparent text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
        <div className="flex items-center gap-2 sm:ml-auto">
          {!myRole && (
            <MembershipButton size="md" teamId={team.id} myRole={myRole} archived={archived} />
          )}
          {canManage && <AddMembersButton teamId={team.id} candidates={candidates} />}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <span className="flex-1">
            {team.members.length} member{team.members.length === 1 ? "" : "s"}
          </span>
          <span className="w-[112px] shrink-0">Role</span>
          <span className="w-7 shrink-0" />
        </div>
        {shown.length ? (
          shown.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              teamId={team.id}
              canManage={canManage}
              isOnlyLead={m.role === "LEAD" && leadCount <= 1}
            />
          ))
        ) : (
          <p className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">
            {q ? `No members match "${query.trim()}".` : "No members yet."}
          </p>
        )}
      </div>
      <p className="text-[11.5px] text-muted-foreground">
        Leads manage the roster, workflow and team details. Anyone in the organization can join.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- labels

const DEFAULT_LABEL_COLOR = "#3b82f6";

function LabelRow({ label, scope }: { label: IssueLabel; scope: string }) {
  const { update, remove } = useLabelMutations();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState(label.color);

  if (editing) {
    return (
      <li className="space-y-2 px-4 py-2.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          className={inputClass}
          aria-label="Label name"
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
    <li className="flex items-center gap-2.5 px-4 py-2">
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
        title="Rename or recolor"
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

function LabelsSection({ team }: { team: { id: string; key: string } }) {
  const { data: labels, isLoading } = useLabels(team.id);
  const { create } = useLabelMutations();
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_LABEL_COLOR);
  const [scope, setScope] = useState<"workspace" | "team">("team");

  const submit = () => {
    if (!name.trim() || create.isPending) return;
    create.mutate(
      { name: name.trim(), color, teamId: scope === "team" ? team.id : undefined },
      { onSuccess: () => setName("") },
    );
  };

  return (
    <Card className="max-w-3xl">
      <CardHeader
        title="Labels"
        subtitle={`${team.key}'s own labels plus workspace labels shared by every team. Click a label to rename or recolor it.`}
      />
      <div className="space-y-3 p-5">
        {isLoading ? (
          <Skeleton className="h-16 w-full rounded-md" />
        ) : labels?.length ? (
          <ul className="divide-y divide-border rounded-md border border-border">
            {labels.map((l) => (
              <LabelRow key={l.id} label={l} scope={l.teamId ? team.key : "Workspace"} />
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
              aria-label="New label name"
            />
            <Select value={scope} onValueChange={(v) => setScope(v as "workspace" | "team")}>
              <SelectTrigger className="w-[140px]" aria-label="Label scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="team">{team.key} only</SelectItem>
                <SelectItem value="workspace">Workspace</SelectItem>
              </SelectContent>
            </Select>
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

// ---------------------------------------------------------------- page

/** Workspace → Teams → a team: its settings, one section per tab, like Linear's team settings. */
export function TeamDetailPage({ teamId, section }: { teamId: string; section: TeamSection }) {
  const { data: team, isLoading, isError } = useTeam(teamId);
  // The list carries the open-issue count; include archived so archived teams resolve too.
  const { data: teams } = useTeams(true);
  const summary = teams?.find((t) => t.id === teamId);
  const { me } = teamAccess(null);
  const myRole = team?.members.find((m) => m.userId === me?.id)?.role ?? null;
  const { isAdmin, canManage } = teamAccess(myRole);
  // Archived teams are read-only on the API (only leaving still works).
  const canEdit = canManage && !team?.archivedAt;

  return (
    <AppShell>
      {isLoading ? (
        <div className="space-y-3 border-b border-border px-4 py-6 lg:px-8">
          <Skeleton className="h-3 w-16" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-md" />
            <Skeleton className="h-6 w-48" />
          </div>
        </div>
      ) : isError || !team ? (
        <PageBody>
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="Team not found"
            description="It may have been removed, or the link is wrong."
            action={
              <Link href="/teams">
                <Button variant="secondary">
                  <ArrowLeft className="h-3.5 w-3.5" /> All teams
                </Button>
              </Link>
            }
          />
        </PageBody>
      ) : (
        <>
          <TeamHeader team={team} summary={summary} myRole={myRole} isAdmin={isAdmin} />
          <PageBody className="space-y-5">
            <SectionTabs teamId={team.id} active={section} memberCount={team.members.length} />
            {section === "general" && (
              <GeneralSection
                // Re-seed the form when the saved values change.
                key={`${team.name}|${team.key}|${team.description ?? ""}`}
                team={team}
                canManage={canEdit}
                isAdmin={isAdmin}
              />
            )}
            {section === "members" && (
              <MembersSection team={team} myRole={myRole} canManage={canEdit} />
            )}
            {section === "workflow" && (
              <div className="max-w-3xl">
                <WorkflowCard team={team} canManage={canEdit} />
              </div>
            )}
            {section === "labels" && <LabelsSection team={team} />}
          </PageBody>
        </>
      )}
    </AppShell>
  );
}
