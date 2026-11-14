"use client";
import { useState } from "react";
import { Check, LogOut, Plus } from "lucide-react";
import { avatarColor, cn } from "@grovyn/utils";
import { Button } from "@grovyn/ui/primitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@grovyn/ui/components/dialog";
import { useTeamMutations } from "@/applications/engineering/hooks/use-issues";
import type { TeamRole } from "@/applications/engineering/lib/issues";
import {
  KEY_PATTERN,
  inputClass,
  normalizeKey,
  suggestKey,
  teamAccess,
} from "@/applications/engineering/lib/teams";

/** A team's mark: its initial on a colour derived from its id (stable across renames). */
export function TeamIcon({
  team,
  size = "sm",
}: {
  team: { id: string; name: string };
  size?: "xs" | "sm" | "lg";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-md font-semibold text-white",
        avatarColor(team.id),
        size === "lg"
          ? "h-10 w-10 text-[16px]"
          : size === "xs"
            ? "h-[18px] w-[18px] rounded-[5px] text-[10px]"
            : "h-6 w-6 text-[11px]",
      )}
    >
      {team.name.trim().charAt(0).toUpperCase() || "#"}
    </span>
  );
}

/**
 * Linear's membership toggle: "Join" on a team you're not in; "Joined" (or "Lead") that turns
 * into "Leave" on hover. Clicks don't bubble, so it can sit inside a clickable row. The API
 * refuses to let the last lead leave and says so in the toast.
 */
export function MembershipButton({
  teamId,
  myRole,
  archived,
  size = "sm",
}: {
  teamId: string;
  myRole: TeamRole | null;
  archived: boolean;
  size?: "sm" | "md";
}) {
  const { me } = teamAccess(myRole);
  const { addMember, removeMember } = useTeamMutations();
  if (!me) return null;
  const pending = addMember.isPending || removeMember.isPending;

  if (!myRole) {
    // Archived teams can't take new members.
    if (archived) return null;
    return (
      <Button
        variant="secondary"
        size={size}
        disabled={pending}
        onClick={(e) => {
          e.stopPropagation();
          addMember.mutate({ id: teamId, userId: me.id, successMessage: "You joined the team" });
        }}
      >
        <Plus className="h-3.5 w-3.5" /> Join
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size={size}
      disabled={pending}
      aria-label="Leave team"
      title="Leave team"
      onClick={(e) => {
        e.stopPropagation();
        removeMember.mutate({ id: teamId, userId: me.id, successMessage: "You left the team" });
      }}
      className="group/membership min-w-[84px] hover:border-rose-500/40 hover:text-rose-600 dark:hover:text-rose-400"
    >
      <span className="inline-flex items-center gap-1.5 group-hover/membership:hidden">
        <Check className="h-3.5 w-3.5" /> {myRole === "LEAD" ? "Lead" : "Joined"}
      </span>
      <span className="hidden items-center gap-1.5 group-hover/membership:inline-flex">
        <LogOut className="h-3.5 w-3.5" /> Leave
      </span>
    </Button>
  );
}

export function CreateTeamDialog({
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

  const canSubmit = name.trim().length >= 2 && KEY_PATTERN.test(key);

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
          <DialogTitle>Create a team</DialogTitle>
          <DialogDescription>
            You&apos;ll lead it. Teams get their own issue identifiers, workflow and cycles.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div>
            <label
              htmlFor="team-name"
              className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Team name
            </label>
            <input
              id="team-name"
              autoFocus
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
            <label
              htmlFor="team-key"
              className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Identifier
            </label>
            <input
              id="team-key"
              value={key}
              onChange={(e) => {
                setKeyTouched(true);
                setKey(normalizeKey(e.target.value));
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
            <label
              htmlFor="team-description"
              className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Description
            </label>
            <textarea
              id="team-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="What does this team work on?"
              className={`mt-1.5 ${inputClass}`}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || create.isPending}>
              {create.isPending ? "Creating…" : "Create team"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
