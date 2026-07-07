import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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

const statusChipStyles: Record<
  Status,
  { base: string; selected: string; dot: string; dotSelected: string }
> = {
  on_track: {
    base: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    selected: "bg-emerald-600 text-white dark:bg-emerald-500",
    dot: "bg-emerald-500",
    dotSelected: "bg-white",
  },
  blocked: {
    base: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
    selected: "bg-rose-600 text-white dark:bg-rose-500",
    dot: "bg-rose-500",
    dotSelected: "bg-white",
  },
  completed: {
    base: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    selected: "bg-blue-600 text-white dark:bg-blue-500",
    dot: "bg-blue-500",
    dotSelected: "bg-white",
  },
};


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
  const queryClient = useQueryClient();
  const auth = getStoredAuth();
  const me = auth?.user;

  const { data: todayCheckIns, isLoading: todayLoading } = useQuery<CheckInItem[]>({
    queryKey: ["checkins", "today"],
    queryFn: () => api.get("/check-ins/today"),
    enabled: isAuthenticated(),
  });

  const submitMutation = useMutation({
    mutationFn: (body: { status: Status; summary: string; blockers?: string }) =>
      api.post("/check-ins", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkins"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setSummary("");
      setBlockers("");
      setStatus("on_track");
      toast.success("Check-in submitted!");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = () => {
    if (!summary.trim()) {
      toast.error("Summary is required");
      return;
    }
    submitMutation.mutate({
      status,
      summary: summary.trim(),
      blockers: blockers.trim() || undefined,
    });
  };

  const submitPanel = (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader title="Submit today's check-in" subtitle="Takes about 30 seconds" />
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
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(["on_track", "blocked", "completed"] as Status[]).map((s) => {
                const selected = status === s;
                const style = statusChipStyles[s];
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-md py-1 text-[13px] font-medium transition-colors",
                      selected ? style.selected : style.base,
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        selected ? style.dotSelected : style.dot,
                      )}
                    />
                    {statusLabel(s)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Summary
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              placeholder="What did you work on today?"
              className="mt-2 w-full rounded-md border border-border bg-background p-3 text-[13px] outline-none focus:border-foreground/40 resize-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Blockers{" "}
              <span className="text-muted-foreground normal-case font-normal">(optional)</span>
            </label>
            <textarea
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              rows={2}
              placeholder="Anything slowing you down?"
              className="mt-2 w-full rounded-md border border-border bg-background p-3 text-[13px] outline-none focus:border-foreground/40 resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-[11px] text-muted-foreground">Auto-posted to your team</span>
            <Button onClick={handleSubmit} disabled={submitMutation.isPending}>
              <ClipboardCheck className="h-3.5 w-3.5" />
              {submitMutation.isPending ? "Submitting…" : "Submit"}
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
