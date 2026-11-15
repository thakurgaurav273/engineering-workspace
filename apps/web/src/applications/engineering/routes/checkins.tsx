import { useEffect, useId, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastError } from "@/shared/lib/errors";
import { AppShell } from "@/platform/shell/app-shell";
import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  Avatar,
  StatusBadge,
  Button,
  Skeleton,
} from "@grovyn/ui/primitives";
import { api } from "@/shared/lib/api";
import { isAuthenticated, getStoredAuth } from "@/platform/auth/auth";
import { avatarColor, userInitials, fullName, relativeTime } from "@grovyn/utils";
import { cn } from "@grovyn/utils";
import { ClipboardCheck } from "lucide-react";
import { type Status, statusLabel } from "@grovyn/types";

const STATUSES: Status[] = ["on_track", "blocked", "completed"];

// Mirrors the API's CreateCheckInDto, so the form explains the rules before submitting.
const SUMMARY_MIN = 10;
const SUMMARY_MAX = 2000;
const BLOCKERS_MAX = 1000;

/** What's wrong with the summary, or null when it's fine. */
function summaryProblem(summary: string): string | null {
  const length = summary.trim().length;
  if (length === 0) return "Write a short summary of what you worked on.";
  if (length < SUMMARY_MIN) {
    const left = SUMMARY_MIN - length;
    return `Add a little more detail - at least ${SUMMARY_MIN} characters (${left} more to go).`;
  }
  return null;
}

/**
 * The summary box with its live hint / inline error. Its own component so each copy gets unique
 * ids - AppShell renders the side panel twice (narrow and wide layouts).
 */
function SummaryField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
}) {
  const id = useId();
  const length = value.trim().length;
  return (
    <div>
      <label
        htmlFor={id}
        className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Summary
      </label>
      <textarea
        id={id}
        data-checkin-summary
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        maxLength={SUMMARY_MAX}
        placeholder="What did you work on today?"
        aria-invalid={!!error}
        aria-describedby={`${id}-hint`}
        className={cn(
          "mt-2 w-full rounded-md border bg-background p-3 text-[13px] outline-none resize-none",
          error
            ? "border-rose-500/60 focus:border-rose-500"
            : "border-border focus:border-foreground/40",
        )}
      />
      <p
        id={`${id}-hint`}
        className={cn(
          "mt-1 text-[11.5px]",
          error ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground",
        )}
      >
        {error ??
          (length < SUMMARY_MIN
            ? `${length} / ${SUMMARY_MIN} characters minimum`
            : `${length} / ${SUMMARY_MAX}`)}
      </p>
    </div>
  );
}

// Status picker: one neutral segmented control. Every option keeps its colour dot, so the
// meaning reads at a glance; only the chosen one is raised and tinted in its colour.
const STATUS_TONE: Record<Status, { dot: string; halo: string; selected: string }> = {
  on_track: {
    dot: "bg-emerald-500",
    halo: "ring-emerald-500/20",
    selected: "text-emerald-700 ring-emerald-500/35 dark:text-emerald-400",
  },
  blocked: {
    dot: "bg-rose-500",
    halo: "ring-rose-500/20",
    selected: "text-rose-700 ring-rose-500/35 dark:text-rose-400",
  },
  completed: {
    dot: "bg-blue-500",
    halo: "ring-blue-500/20",
    selected: "text-blue-700 ring-blue-500/35 dark:text-blue-400",
  },
};

function StatusPicker({ value, onChange }: { value: Status; onChange: (s: Status) => void }) {
  // Radio-group keys: arrows move the selection (and focus) to the neighbouring option.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const next = STATUSES[(STATUSES.indexOf(value) + step + STATUSES.length) % STATUSES.length];
    onChange(next);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-status="${next}"]`)?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label="Current status"
      onKeyDown={onKeyDown}
      className="mt-2 flex gap-1 rounded-lg border border-border bg-surface p-1"
    >
      {STATUSES.map((s) => {
        const selected = value === s;
        const tone = STATUS_TONE[s];
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            data-status={s}
            onClick={() => onChange(s)}
            className={cn(
              "flex h-8 min-w-0 flex-auto items-center justify-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              selected
                ? cn("bg-card shadow-sm ring-1", tone.selected)
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full transition-shadow",
                tone.dot,
                selected && cn("ring-[3px]", tone.halo),
              )}
            />
            <span className="truncate">{statusLabel(s)}</span>
          </button>
        );
      })}
    </div>
  );
}

interface CheckInItem {
  id: string;
  status: Status;
  summary: string;
  blockers?: string | null;
  date: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    jobTitle?: string;
    department?: string;
  };
}

export function CheckInsPage() {
  const [status, setStatus] = useState<Status>("on_track");
  const [summary, setSummary] = useState("");
  const [blockers, setBlockers] = useState("");
  // Inline errors appear after the first submit attempt, then update as you type.
  const [attempted, setAttempted] = useState(false);
  const summaryError = attempted ? summaryProblem(summary) : null;
  const queryClient = useQueryClient();
  const auth = getStoredAuth();
  const me = auth?.user;

  const { data: todayCheckIns, isLoading: todayLoading } = useQuery<CheckInItem[]>({
    queryKey: ["checkins", "today"],
    queryFn: () => api.get("/check-ins/today"),
    enabled: isAuthenticated(),
  });

  // The user's own check-in for today (if already submitted) - drives edit mode.
  const myCheckIn = todayCheckIns?.find((c) => c.user.id === me?.id) ?? null;
  const [editingId, setEditingId] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setStatus("on_track");
    setSummary("");
    setBlockers("");
    setAttempted(false);
  };

  // Prefill the panel with today's check-in once it loads, so it becomes an editor.
  useEffect(() => {
    if (myCheckIn && editingId !== myCheckIn.id) {
      setEditingId(myCheckIn.id);
      setStatus(myCheckIn.status);
      setSummary(myCheckIn.summary);
      setBlockers(myCheckIn.blockers ?? "");
    } else if (!myCheckIn && editingId) {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myCheckIn?.id]);

  const submitMutation = useMutation({
    mutationFn: (body: { status: Status; summary: string; blockers?: string }) =>
      api.post("/check-ins", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkins"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Check-in submitted");
    },
    onError: (err: Error) => {
      toastError(err, "Couldn't submit your check-in");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { status: Status; summary: string; blockers?: string };
    }) => api.patch(`/check-ins/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkins"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Check-in updated");
    },
    onError: (err: Error) => toastError(err, "Couldn't update your check-in"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/check-ins/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkins"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      resetForm();
      toast.success("Check-in deleted");
    },
    onError: (err: Error) => toastError(err, "Couldn't delete the check-in"),
  });

  const saving = editingId ? updateMutation.isPending : submitMutation.isPending;

  const handleSubmit = () => {
    setAttempted(true);
    if (summaryProblem(summary)) {
      // Focus whichever copy of the panel is on screen.
      [...document.querySelectorAll<HTMLTextAreaElement>("[data-checkin-summary]")]
        .find((el) => el.offsetParent !== null)
        ?.focus();
      return;
    }
    const body = {
      status,
      summary: summary.trim(),
      blockers: blockers.trim() || undefined,
    };
    if (editingId) updateMutation.mutate({ id: editingId, body });
    else submitMutation.mutate(body);
  };

  const submitPanel = (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader
          title={editingId ? "Edit today's check-in" : "Submit today's check-in"}
          subtitle={editingId ? "Update your check-in for today" : "Takes about 30 seconds"}
        />
        <div className="p-5 space-y-4">
          {me && (
            <div className="flex items-center gap-2.5">
              <Avatar
                initials={userInitials(me.firstName, me.lastName)}
                color={avatarColor(me.id)}
                size="sm"
                src={me.avatarUrl}
              />
              <div className="text-[12.5px]">
                <span className="font-medium">{fullName(me.firstName, me.lastName)}</span>
                <span className="text-muted-foreground"> · {me.department ?? me.jobTitle}</span>
              </div>
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Current status
            </label>
            <StatusPicker value={status} onChange={setStatus} />
          </div>

          <SummaryField value={summary} onChange={setSummary} error={summaryError} />

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Blockers{" "}
              <span className="text-muted-foreground normal-case font-normal">(optional)</span>
            </label>
            <textarea
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              rows={2}
              maxLength={BLOCKERS_MAX}
              placeholder="Anything slowing you down?"
              className="mt-2 w-full rounded-md border border-border bg-background p-3 text-[13px] outline-none focus:border-foreground/40 resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            {editingId ? (
              <button
                onClick={() => editingId && deleteMutation.mutate(editingId)}
                disabled={deleteMutation.isPending}
                className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-rose-600 disabled:opacity-50 dark:hover:text-rose-400"
              >
                Delete check-in
              </button>
            ) : (
              <span className="text-[11px] text-muted-foreground">Auto-posted to your team</span>
            )}
            <Button onClick={handleSubmit} disabled={saving}>
              <ClipboardCheck className="h-3.5 w-3.5" />
              {saving ? "Saving…" : editingId ? "Update" : "Submit"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );

  return (
    <AppShell right={submitPanel}>
      <PageHeader
        title="Check-ins"
        description="A daily pulse from every engineer. Simple, fast, honest."
      />
      <PageBody>
        <Card>
          <CardHeader
            title="Today's check-ins"
            action={
              todayLoading ? undefined : (
                <span className="text-[11.5px] text-muted-foreground">
                  {todayCheckIns?.length ?? 0} submitted
                </span>
              )
            }
          />
          {todayLoading ? (
            <ul>
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="flex gap-4 p-5 border-b border-border last:border-0">
                  <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </li>
              ))}
            </ul>
          ) : !todayCheckIns?.length ? (
            <div className="p-8 text-center text-[12.5px] text-muted-foreground">
              No check-ins yet today.
            </div>
          ) : (
            <ul className="relative">
              <div className="absolute left-[35px] top-6 bottom-6 w-px bg-border" />
              {todayCheckIns.map((c) => (
                <li
                  key={c.id}
                  className="relative flex gap-4 p-5 border-b border-border last:border-0"
                >
                  <Avatar
                    initials={userInitials(c.user.firstName, c.user.lastName)}
                    color={avatarColor(c.user.id)}
                    size="md"
                    src={c.user.avatarUrl}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold">
                        {fullName(c.user.firstName, c.user.lastName)}
                      </span>
                      <span className="text-[11.5px] text-muted-foreground">
                        {c.user.department}
                      </span>
                      <StatusBadge status={c.status} />
                      <span className="ml-auto text-[11px] text-muted-foreground font-mono-num">
                        {relativeTime(c.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-[13px] text-foreground leading-relaxed">{c.summary}</p>
                    {c.blockers && (
                      <div className="mt-3 rounded-md border border-rose-500/20 bg-rose-500/5 p-3">
                        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400 mb-1">
                          Blocker
                        </div>
                        <p className="text-[12.5px]">{c.blockers}</p>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </PageBody>
    </AppShell>
  );
}
