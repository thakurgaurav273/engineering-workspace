import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/platform/shell/app-shell";
import {
  Card,
  CardHeader,
  Metric,
  Avatar,
  StatusBadge,
  Progress,
  Badge,
  Button,
  PageBody,
  PageHeader,
  Skeleton,
} from "@grovyn/ui/primitives";
import { ProgressStatusPill, type TaskUpdateStatus } from "@/applications/engineering/components/task-updates";
import { api } from "@/shared/lib/api";
import { isAuthenticated } from "@/platform/auth/auth";
import { avatarColor, userInitials, fullName, relativeTime, fmtDate } from "@grovyn/utils";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import {
  Plus,
  ArrowUpRight,
  Sparkles,
  ClipboardCheck,
  FileText,
  ListTodo,
  Loader2,
} from "lucide-react";
import type { Status } from "@grovyn/types";


interface DashboardData {
  checkInRate: number;
  blockedMembers: number;
  pendingReviews: number;
  activeGoals: number;
  recognitionCount: number;
  avgPerformanceScore: number;
  weeklyTrends: { date: string; count: number }[];
  goalDistribution: { active: number; completed: number; archived: number };
  recentRecognitions: {
    id: string;
    title: string;
    note?: string;
    createdAt: string;
    author: { id: string; firstName: string; lastName: string; avatarUrl?: string };
    recipient: { id: string; firstName: string; lastName: string; avatarUrl?: string };
  }[];
  recentTaskUpdates: {
    id: string;
    body: string;
    status: TaskUpdateStatus;
    progress: number | null;
    createdAt: string;
    author: { id: string; firstName: string; lastName: string; avatarUrl?: string };
    issue: { id: string; identifier: string; title: string };
  }[];
  workspace: { pending: number; inProgress: number; overdue: number; dueToday: number };
  topContributors: {
    user: {
      id: string;
      firstName: string;
      lastName: string;
      avatarUrl?: string;
      jobTitle?: string;
      department?: string;
    };
    checkInStreak: number;
    goalCompletion: number;
  }[];
}

interface TodayCheckIn {
  id: string;
  status: Status;
  summary: string;
  blockers?: string;
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

export function Dashboard() {
  const [exporting, setExporting] = useState(false);

  const { data: dash, isLoading: dashLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/dashboard"),
    enabled: isAuthenticated(),
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      await api.download(
        "/dashboard/export",
        `dashboard-export-${new Date().toISOString().slice(0, 10)}.csv`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't export dashboard");
    } finally {
      setExporting(false);
    }
  };

  const { data: todayCheckins, isLoading: checkinsLoading } = useQuery<TodayCheckIn[]>({
    queryKey: ["checkins", "today"],
    queryFn: () => api.get("/check-ins/today"),
    enabled: isAuthenticated(),
  });

  const blocked = (todayCheckins ?? []).filter((c) => c.status === "blocked");

  const checkInTrend = (dash?.weeklyTrends ?? []).map((t) => ({
    day: new Date(t.date).toLocaleDateString("en-US", { weekday: "short" }),
    rate: t.count,
  }));

  const goalProgress = [
    { name: "Active", value: dash?.goalDistribution.active ?? 0 },
    { name: "Completed", value: dash?.goalDistribution.completed ?? 0 },
    { name: "Archived", value: dash?.goalDistribution.archived ?? 0 },
  ];

  const totalGoals = goalProgress.reduce((s, g) => s + g.value, 0);

  return (
    <AppShell right={<RightPanel blocked={blocked} dash={dash} isLoading={dashLoading} />}>
      <PageHeader
        title="Dashboard"
        description="A snapshot of your engineering org this week."
        actions={
          <>
            <Button variant="secondary" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {exporting ? "Exporting…" : "Export"}
            </Button>
            <Button>
              <Plus className="h-3.5 w-3.5" />
              <Link href="/checkins">New check-in</Link>
            </Button>
          </>
        }
      />
      <PageBody className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {dashLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-5 space-y-2.5">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="h-6 w-14" />
              </div>
            ))
          ) : (
            <>
              <Metric label="Check-in rate" value={`${dash?.checkInRate ?? 0}%`} hint="this week" />
              <Metric
                label="Blocked"
                value={dash?.blockedMembers ?? 0}
                deltaTone="warning"
                hint="today"
              />
              <Metric
                label="Pending reviews"
                value={dash?.pendingReviews ?? 0}
                hint="need your action"
              />
              <Metric label="Open goals" value={dash?.activeGoals ?? 0} hint="active org-wide" />
              <Metric label="Recognitions" value={dash?.recognitionCount ?? 0} hint="this week" />
              <Metric
                label="Avg score"
                value={dash?.avgPerformanceScore ?? 0}
                hint="last 30 days"
              />
            </>
          )}
        </div>

        <Card>
          <CardHeader
            title="My Workspace"
            subtitle="Your personal action items"
            action={
              <Link
                href="/workspace"
                className="text-[11.5px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                Open <ArrowUpRight className="h-3 w-3" />
              </Link>
            }
          />
          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
            {dashLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-2.5 w-16" />
                  <Skeleton className="h-6 w-10" />
                </div>
              ))
            ) : (
              <>
                <WorkspaceStat label="Pending" value={dash?.workspace.pending ?? 0} />
                <WorkspaceStat label="In progress" value={dash?.workspace.inProgress ?? 0} />
                <WorkspaceStat
                  label="Due today"
                  value={dash?.workspace.dueToday ?? 0}
                  tone={dash?.workspace.dueToday ? "warning" : "neutral"}
                />
                <WorkspaceStat
                  label="Overdue"
                  value={dash?.workspace.overdue ?? 0}
                  tone={dash?.workspace.overdue ? "warning" : "neutral"}
                />
              </>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Check-in activity"
              subtitle="Daily check-ins (last 7 days)"
              action={<Badge tone="info">Weekly</Badge>}
            />
            <div className="p-4 h-[240px]">
              {dashLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={checkInTrend}
                    margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="var(--color-border)"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="rate"
                      stroke="var(--color-chart-1)"
                      strokeWidth={2}
                      fill="url(#cg)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Goal progress" subtitle="Across all teams" />
            <div className="p-5 space-y-4">
              {dashLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-3 w-14" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <Skeleton className="h-1.5 w-full rounded-full" />
                    </div>
                  ))
                : goalProgress.map((g) => {
                    const pct = totalGoals > 0 ? Math.round((g.value / totalGoals) * 100) : 0;
                    return (
                      <div key={g.name}>
                        <div className="flex items-center justify-between text-[12px] mb-1.5">
                          <span className="text-foreground">{g.name}</span>
                          <span className="font-mono-num text-muted-foreground">
                            {g.value} <span className="text-border">·</span> {pct}%
                          </span>
                        </div>
                        <Progress value={pct} />
                      </div>
                    );
                  })}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Recent check-ins"
              action={
                <Link
                  href="/checkins"
                  className="text-[11.5px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  View all <ArrowUpRight className="h-3 w-3" />
                </Link>
              }
            />
            <ul className="divide-y divide-border">
              {checkinsLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <li key={i} className="flex items-start gap-3 px-5 py-3.5">
                      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-1/3" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </li>
                  ))
                : (todayCheckins ?? []).slice(0, 5).map((c) => (
                    <li key={c.id} className="flex items-start gap-3 px-5 py-3.5">
                      <Avatar
                        initials={userInitials(c.user.firstName, c.user.lastName)}
                        color={avatarColor(c.user.id)}
                        size="sm"
                        src={c.user.avatarUrl}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-medium truncate">
                            {fullName(c.user.firstName, c.user.lastName)}
                          </span>
                          <StatusBadge status={c.status} />
                          <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                            {relativeTime(c.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-[12.5px] text-muted-foreground line-clamp-2">
                          {c.summary}
                        </p>
                      </div>
                    </li>
                  ))}
              {!checkinsLoading && !todayCheckins?.length && (
                <li className="px-5 py-6 text-[12.5px] text-muted-foreground">
                  No check-ins today yet.
                </li>
              )}
            </ul>
          </Card>

          <Card>
            <CardHeader
              title="Recent recognition"
              action={
                <Link
                  href="/recognition"
                  className="text-[11.5px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  View all <ArrowUpRight className="h-3 w-3" />
                </Link>
              }
            />
            <ul className="divide-y divide-border">
              {dashLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <li key={i} className="flex items-start gap-3 px-5 py-3.5">
                      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-1/3" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </li>
                  ))
                : (dash?.recentRecognitions ?? []).slice(0, 5).map((r) => (
                    <li key={r.id} className="flex items-start gap-3 px-5 py-3.5">
                      <Avatar
                        initials={userInitials(r.recipient.firstName, r.recipient.lastName)}
                        color={avatarColor(r.recipient.id)}
                        size="sm"
                        src={r.recipient.avatarUrl}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-medium truncate">
                            {fullName(r.recipient.firstName, r.recipient.lastName)}
                          </span>
                          <span className="text-[11.5px] text-muted-foreground">
                            from {fullName(r.author.firstName, r.author.lastName)}
                          </span>
                          <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                            {relativeTime(r.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-[12.5px] text-foreground truncate">{r.title}</p>
                      </div>
                    </li>
                  ))}
              {!dashLoading && !dash?.recentRecognitions?.length && (
                <li className="px-5 py-6 text-[12.5px] text-muted-foreground">
                  No recognitions yet.
                </li>
              )}
            </ul>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Recent task updates from your reports"
            action={
              <Link
                href="/task-updates"
                className="text-[11.5px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                View all <ArrowUpRight className="h-3 w-3" />
              </Link>
            }
          />
          <ul className="divide-y divide-border">
            {dashLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <li key={i} className="flex items-start gap-3 px-5 py-3.5">
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-1/3" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </li>
                ))
              : (dash?.recentTaskUpdates ?? []).slice(0, 5).map((t) => (
                  <li key={t.id} className="flex items-start gap-3 px-5 py-3.5">
                    <Avatar
                      initials={userInitials(t.author.firstName, t.author.lastName)}
                      color={avatarColor(t.author.id)}
                      size="sm"
                      src={t.author.avatarUrl}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-medium truncate">
                          {fullName(t.author.firstName, t.author.lastName)}
                        </span>
                        <span className="text-[11.5px] text-muted-foreground font-mono-num">
                          {t.issue.identifier}
                        </span>
                        <ProgressStatusPill status={t.status} />
                        <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                          {relativeTime(t.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-[12.5px] text-muted-foreground line-clamp-2">
                        {t.body}
                      </p>
                    </div>
                  </li>
                ))}
            {!dashLoading && !dash?.recentTaskUpdates?.length && (
              <li className="px-5 py-6 text-[12.5px] text-muted-foreground">
                No task updates from your reports yet.
              </li>
            )}
          </ul>
        </Card>
      </PageBody>
    </AppShell>
  );
}

function WorkspaceStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning";
}) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`mt-1 font-mono-num text-[20px] font-semibold ${tone === "warning" ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}

function RightPanel({
  blocked,
  dash,
  isLoading,
}: {
  blocked: TodayCheckIn[];
  dash?: DashboardData;
  isLoading?: boolean;
}) {
  const topContributors = dash?.topContributors ?? [];
  return (
    <div className="p-5 space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
            Blocked today
          </h3>
          {!isLoading && <Badge tone="warning">{blocked.length}</Badge>}
        </div>
        <ul className="space-y-2">
          {isLoading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 p-2">
                <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              </div>
            ))
          ) : (
            <>
              {blocked.map((c) => (
                <Link
                  key={c.id}
                  href={`/people/${c.user.id}`}
                  className="flex items-center gap-2.5 rounded-md p-2 hover:bg-accent transition-colors"
                >
                  <Avatar
                    initials={userInitials(c.user.firstName, c.user.lastName)}
                    color={avatarColor(c.user.id)}
                    size="sm"
                    src={c.user.avatarUrl}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium truncate">
                      {fullName(c.user.firstName, c.user.lastName)}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {c.user.department} · {relativeTime(c.createdAt)}
                    </div>
                  </div>
                  <StatusBadge status={c.status} />
                </Link>
              ))}
              {!blocked.length && (
                <p className="text-[12px] text-muted-foreground">No blockers today.</p>
              )}
            </>
          )}
        </ul>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
            Top contributors
          </h3>
          <Link
            href="/leaderboard"
            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            All <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <ul className="space-y-2">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5 p-2">
                  <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-2.5 w-1/2" />
                  </div>
                </div>
              ))
            : topContributors.map((c, i) => (
                <Link
                  key={c.user.id}
                  href={`/people/${c.user.id}`}
                  className="flex items-center gap-2.5 rounded-md p-2 hover:bg-accent transition-colors"
                >
                  <span className="w-4 text-[11px] font-mono-num text-muted-foreground text-right">
                    {i + 1}
                  </span>
                  <Avatar
                    initials={userInitials(c.user.firstName, c.user.lastName)}
                    color={avatarColor(c.user.id)}
                    size="sm"
                    src={c.user.avatarUrl}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium truncate">
                      {fullName(c.user.firstName, c.user.lastName)}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {c.user.jobTitle}
                    </div>
                  </div>
                  <span className="font-mono-num text-[12.5px] font-semibold">
                    {c.goalCompletion}%
                  </span>
                </Link>
              ))}
        </ul>
      </div>

      <div>
        <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Quick actions
        </h3>
        <div className="space-y-2">
          <Link
            href="/workspace"
            className="flex items-center gap-2.5 rounded-md border border-border p-2.5 hover:bg-accent transition-colors"
          >
            <ListTodo className="h-4 w-4 text-muted-foreground" />
            <span className="text-[12.5px] font-medium">Add an action item</span>
          </Link>
          <Link
            href="/checkins"
            className="flex items-center gap-2.5 rounded-md border border-border p-2.5 hover:bg-accent transition-colors"
          >
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            <span className="text-[12.5px] font-medium">Submit today's check-in</span>
          </Link>
          <Link
            href="/recognition"
            className="flex items-center gap-2.5 rounded-md border border-border p-2.5 hover:bg-accent transition-colors"
          >
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <span className="text-[12.5px] font-medium">Recognize a teammate</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
