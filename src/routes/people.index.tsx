import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import {
  PageHeader,
  PageBody,
  Card,
  Avatar,
  StatusBadge,
  Progress,
  Button,
  Badge,
  SkeletonPersonCard,
} from "@/components/primitives";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { isAuthenticated, getStoredAuth, updateStoredUser, type AuthUser } from "@/lib/auth";
import { avatarColor, userInitials, fullName } from "@/lib/transforms";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Search, SlidersHorizontal, Plus, X, Loader2 } from "lucide-react";
import { type Status, statusLabel } from "@/lib/mock-data";

export const Route = createFileRoute("/people/")({ component: PeoplePage });

interface LeaderboardEntry {
  rank: number;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    jobTitle?: string;
    department?: string;
  };
  checkInScore: number;
  goalScore: number;
  recognitionScore: number;
  linearScore: number | null;
  linearIssuesCompleted: number;
  linearPoints: number;
  totalScore: number;
  trend: string;
}

interface LeaderboardData {
  rankings: LeaderboardEntry[];
  availableDepartments: string[];
}

interface CheckInToday {
  userId: string;
  status: Status;
}

const ALL_STATUSES: Status[] = ["on_track", "blocked", "completed"];

function PeoplePage() {
  const [q, setQ] = useState("");
  const [dept, setDept] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<Status[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const queryClient = useQueryClient();

  const { data: me } = useQuery<AuthUser>({
    queryKey: ["auth", "me"],
    queryFn: () => api.get("/auth/me"),
    enabled: isAuthenticated(),
  });

  useEffect(() => {
    if (me) updateStoredUser(me);
  }, [me]);

  const currentUser = me ?? getStoredAuth()?.user;
  const canInvite = currentUser?.role === "OWNER" || currentUser?.role === "ADMIN";

  const debouncedQ = useDebouncedValue(q, 300);

  const {
    data: leaderboard,
    isLoading: leaderboardLoading,
    isFetching: leaderboardFetching,
  } = useQuery<LeaderboardData>({
    queryKey: ["leaderboard", "week", debouncedQ, dept],
    queryFn: () => {
      const params = new URLSearchParams({ period: "week" });
      if (debouncedQ.trim()) params.set("search", debouncedQ.trim());
      if (dept !== "all") params.set("department", dept);
      return api.get(`/leaderboard?${params.toString()}`);
    },
    enabled: isAuthenticated(),
    placeholderData: keepPreviousData,
  });

  // True during the debounce window too, not just the network round trip - otherwise
  // the spinner blips off for the ~300ms between keystrokes and typing looks broken.
  const isSearching = q !== debouncedQ || leaderboardFetching;

  const { data: todayCheckIns } = useQuery<CheckInToday[]>({
    queryKey: ["checkins", "today"],
    queryFn: () => api.get("/check-ins/today"),
    enabled: isAuthenticated(),
    select: (data: any[]) => data.map((c) => ({ userId: c.user.id, status: c.status })),
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      api.post("/invitations", {
        email: inviteEmail.trim(),
        role: inviteRole,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      toast.success(`Invitation sent to ${inviteEmail.trim()}`);
      setInviteEmail("");
      setInviteRole("MEMBER");
      setShowInvite(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleInvite = () => {
    if (!inviteEmail.trim()) {
      toast.error("Email is required");
      return;
    }
    inviteMutation.mutate();
  };

  const statusByUser = useMemo(() => {
    const map: Record<string, Status> = {};
    (todayCheckIns ?? []).forEach((c) => {
      map[c.userId] = c.status;
    });
    return map;
  }, [todayCheckIns]);

  const rankings = leaderboard?.rankings ?? [];
  const linearConnected = rankings.some((r) => r.linearScore !== null);
  const departments = leaderboard?.availableDepartments ?? [];

  // Search and department are already applied server-side (see the leaderboard query
  // above) - today's check-in status has no backend home (it's a live join with
  // /check-ins/today, not a Membership field) so it's the only filter still applied
  // client-side, over the already-filtered, already-small result set.
  const filtered = useMemo(
    () =>
      rankings.filter((r) => {
        const status: Status = statusByUser[r.user.id] ?? "on_track";
        return statusFilter.length === 0 || statusFilter.includes(status);
      }),
    [rankings, statusFilter, statusByUser],
  );

  return (
    <AppShell>
      <PageHeader
        title="People"
        description={
          leaderboardLoading ? " " : `${rankings.length} engineers across your organization.`
        }
        actions={
          <>
            <FiltersPanel statuses={statusFilter} onChange={setStatusFilter} />
            {canInvite && (
              <Button onClick={() => setShowInvite((v) => !v)}>
                <Plus className="h-3.5 w-3.5" />
                Invite
              </Button>
            )}
          </>
        }
      />
      <PageBody className="space-y-5">
        {showInvite && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[13.5px] font-semibold">Invite a teammate</div>
                <div className="text-[11.5px] text-muted-foreground mt-0.5">
                  We'll email them an invite link to join — works even if they already have a Grovyn
                  One account elsewhere.
                </div>
              </div>
              <button
                onClick={() => setShowInvite(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Email
                </label>
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  type="email"
                  className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "ADMIN" | "MEMBER")}
                  className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setShowInvite(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInvite} disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? "Sending…" : "Send invite"}
                </Button>
              </div>
            </div>
          </Card>
        )}

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 flex-1">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or team"
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            />
            {isSearching && <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />}
          </div>
          <FilterPills
            label="Dept"
            value={dept}
            onChange={setDept}
            options={[{ v: "all", l: "All" }, ...departments.map((d) => ({ v: d, l: d }))]}
          />
        </div>

        {leaderboardLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonPersonCard key={i} />
            ))}
          </div>
        ) : !filtered.length ? (
          <div className="py-16 text-center text-[12.5px] text-muted-foreground">
            No people found.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((entry) => {
              const u = entry.user;
              const status: Status = statusByUser[u.id] ?? "on_track";
              return (
                <Link key={u.id} to="/people/$id" params={{ id: u.id }} className="group">
                  <Card className="p-5 hover:border-foreground/20 hover:shadow-sm transition-all">
                    <div className="flex items-start gap-3">
                      <Avatar
                        initials={userInitials(u.firstName, u.lastName)}
                        color={avatarColor(u.id)}
                        size="lg"
                        src={u.avatarUrl}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold text-foreground truncate">
                          {fullName(u.firstName, u.lastName)}
                        </div>
                        <div className="text-[12px] text-muted-foreground truncate">
                          {u.jobTitle}
                        </div>
                        {u.department && (
                          <div className="mt-1">
                            <Badge>{u.department}</Badge>
                          </div>
                        )}
                      </div>
                      <StatusBadge status={status} />
                    </div>
                    <div
                      className={`mt-4 grid gap-3 pt-4 border-t border-border ${linearConnected ? "grid-cols-4" : "grid-cols-3"}`}
                    >
                      <Stat label="Score" value={entry.totalScore} />
                      <Stat label="Check-in" value={`${entry.checkInScore}%`} />
                      <Stat label="Goals" value={`${entry.goalScore}%`} />
                      {linearConnected && (
                        <Stat label="Linear" value={entry.linearIssuesCompleted} />
                      )}
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                        <span>Goal completion</span>
                        <span className="font-mono-num">{entry.goalScore}%</span>
                      </div>
                      <Progress value={entry.goalScore} />
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </PageBody>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono-num text-[14px] font-semibold text-foreground">{value}</div>
    </div>
  );
}

function FilterPills({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5 flex-wrap">
      <span className="px-2 text-[11px] text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      {options.slice(0, 6).map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`px-2 py-1 rounded text-[12px] transition-colors ${value === o.v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function FiltersPanel({
  statuses,
  onChange,
}: {
  statuses: Status[];
  onChange: (s: Status[]) => void;
}) {
  const toggle = (s: Status) => {
    onChange(statuses.includes(s) ? statuses.filter((x) => x !== s) : [...statuses, s]);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters{statuses.length ? ` (${statuses.length})` : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
          Status
        </div>
        <div className="space-y-2">
          {ALL_STATUSES.map((s) => (
            <label key={s} className="flex items-center gap-2 text-[12.5px] cursor-pointer">
              <Checkbox checked={statuses.includes(s)} onCheckedChange={() => toggle(s)} />
              {statusLabel(s)}
            </label>
          ))}
        </div>
        {statuses.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="mt-3 text-[11.5px] text-muted-foreground hover:text-foreground"
          >
            Clear filters
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
