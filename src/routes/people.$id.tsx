import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PageBody, Card, CardHeader, Avatar, StatusBadge, Progress, Button, Badge, EmptyState, Skeleton, SkeletonListItem } from "@/components/primitives";
import { IssueCard, TaskUpdateTimelineItem, type IssueListItem, type TaskUpdateItem } from "@/components/task-updates";
import { useWorkspaceSummary } from "@/hooks/use-workspace";
import { api, type Paginated } from "@/lib/api";
import { isAuthenticated, getStoredAuth, updateStoredUser, type AuthUser } from "@/lib/auth";
import { avatarColor, userInitials, fullName, relativeTime, fmtDate, weekLabel, fmtDateFull } from "@/lib/transforms";
import { ArrowLeft, Sparkles, Target, ClipboardCheck, ListChecks, FileText, CheckCircle2, MessageSquare, KeyRound, UserX, UserCheck } from "lucide-react";
import type { Status } from "@/lib/mock-data";

export const Route = createFileRoute("/people/$id")({ component: PersonPage });

type OrgRole = "OWNER" | "ADMIN" | "MEMBER";

interface Person {
  id: string; email: string; firstName: string; lastName: string; avatarUrl?: string;
  orgId: string; managerId?: string; jobTitle?: string; department?: string; role: OrgRole;
  isActive: boolean; createdAt: string;
  manager?: { id: string; firstName: string; lastName: string; avatarUrl?: string; jobTitle?: string } | null;
  reports: { id: string; firstName: string; lastName: string }[];
}

interface CheckInItem {
  id: string; status: Status; summary: string; blockers?: string | null; date: string; createdAt: string;
}

interface GoalItem {
  id: string; title: string; description?: string | null; progress: number;
  status: "active" | "completed" | "archived"; dueDate?: string | null;
  completedAt?: string | null; createdAt: string; updatedAt: string;
}

interface ReviewItem {
  id: string; type: "self" | "manager"; weekStart: string; wins?: string | null;
  challenges?: string | null; learning?: string | null; feedback?: string | null;
  rating?: number | null; status: string; submittedAt?: string | null;
  reviewer: { id: string; firstName: string; lastName: string; avatarUrl?: string };
}

interface RecognitionItem {
  id: string; title: string; note?: string | null; createdAt: string;
  author: { id: string; firstName: string; lastName: string; avatarUrl?: string };
}

interface TimelineItem {
  type: "check-in" | "goal" | "review" | "recognition" | "task-update";
  date: string;
  data: Record<string, unknown>;
}

type Tab = "overview" | "checkins" | "goals" | "reviews" | "recognition" | "timeline" | "task-updates";

interface UserTaskActivity {
  issues: IssueListItem[];
  updates: TaskUpdateItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

function PersonPage() {
  const { id } = Route.useParams();
  const [tab, setTab] = useState<Tab>("overview");
  const queryClient = useQueryClient();

  const { data: person, isLoading } = useQuery<Person>({
    queryKey: ['people', id],
    queryFn: () => api.get(`/people/${id}`),
    enabled: isAuthenticated(),
  });

  const { data: me } = useQuery<AuthUser>({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get('/auth/me'),
    enabled: isAuthenticated(),
  });

  useEffect(() => {
    if (me) updateStoredUser(me);
  }, [me]);

  const currentUser = me ?? getStoredAuth()?.user;
  const canViewTaskUpdates = !!currentUser && !!person && (
    currentUser.id === person.id ||
    currentUser.role === "OWNER" ||
    currentUser.role === "ADMIN" ||
    person.managerId === currentUser.id
  );

  const { data: taskActivity, isLoading: taskActivityLoading } = useQuery<UserTaskActivity>({
    queryKey: ['people', id, 'task-updates'],
    queryFn: () => api.get(`/task-updates/users/${id}?limit=20`),
    enabled: isAuthenticated() && !!id && canViewTaskUpdates && tab === "task-updates",
  });

  // Same visibility rule as task-updates: self, org admin/owner, or this person's direct
  // manager. The backend independently re-scopes a manager's counts to items they
  // personally assigned - this flag only decides whether to render the card at all.
  const { data: workspaceSummary } = useWorkspaceSummary(id, canViewTaskUpdates);

  const roleMutation = useMutation({
    mutationFn: (role: "ADMIN" | "MEMBER") => api.patch(`/users/${id}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people', id] });
      toast.success("Role updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: (isActive: boolean) => api.patch(`/users/${id}/status`, { isActive }),
    onSuccess: (_data, isActive) => {
      queryClient.invalidateQueries({ queryKey: ['people', id] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      toast.success(isActive ? "Account reactivated" : "Account deactivated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () => api.post(`/users/${id}/reset-password`),
    onSuccess: () => toast.success("New password emailed to user"),
    onError: (err: Error) => toast.error(err.message),
  });

  const { data: checkInsData, isLoading: checkInsLoading } = useQuery<Paginated<CheckInItem>>({
    queryKey: ['people', id, 'checkins'],
    queryFn: () => api.get(`/people/${id}/check-ins?limit=50`),
    enabled: isAuthenticated() && !!id,
  });

  const { data: goalsData, isLoading: goalsLoading } = useQuery<Paginated<GoalItem>>({
    queryKey: ['people', id, 'goals'],
    queryFn: () => api.get(`/people/${id}/goals?limit=50`),
    enabled: isAuthenticated() && !!id,
  });

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery<Paginated<ReviewItem>>({
    queryKey: ['people', id, 'reviews'],
    queryFn: () => api.get(`/people/${id}/reviews?limit=50`),
    enabled: isAuthenticated() && !!id,
  });

  const { data: recognitionsData, isLoading: recognitionsLoading } = useQuery<Paginated<RecognitionItem>>({
    queryKey: ['people', id, 'recognitions'],
    queryFn: () => api.get(`/people/${id}/recognitions?limit=50`),
    enabled: isAuthenticated() && !!id,
  });

  const { data: timeline, isLoading: timelineLoading } = useQuery<TimelineItem[]>({
    queryKey: ['people', id, 'timeline'],
    queryFn: () => api.get(`/people/${id}/timeline`),
    enabled: isAuthenticated() && !!id && tab === 'timeline',
  });

  const checkIns = checkInsData?.data ?? [];
  const goals = goalsData?.data ?? [];
  const reviews = reviewsData?.data ?? [];
  const recognitions = recognitionsData?.data ?? [];

  const lastCheckIn = checkIns[0];
  const lastStatus: Status = lastCheckIn?.status ?? 'on_track';

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "checkins", label: "Check-ins", count: checkInsData?.total },
    { id: "goals", label: "Goals", count: goalsData?.total },
    { id: "reviews", label: "Reviews", count: reviewsData?.total },
    { id: "recognition", label: "Recognition", count: recognitionsData?.total },
    { id: "timeline", label: "Timeline" },
    ...(canViewTaskUpdates ? [{ id: "task-updates" as Tab, label: "Task Updates" }] : []),
  ];

  if (isLoading) {
    return (
      <AppShell>
        <div className="border-b border-border">
          <div className="px-4 lg:px-8 pt-6 pb-6">
            <Skeleton className="h-3.5 w-24 mb-4" />
            <div className="flex items-start gap-5">
              <Skeleton className="h-16 w-16 rounded-full shrink-0" />
              <div className="space-y-2 pt-1">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3.5 w-56" />
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 max-w-3xl">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-md border border-border bg-card p-3.5 space-y-2">
                  <Skeleton className="h-2.5 w-16" />
                  <Skeleton className="h-5 w-8" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <PageBody>
          <SkeletonListItem lines={3} />
        </PageBody>
      </AppShell>
    );
  }

  if (!person) {
    return (
      <AppShell>
        <div className="p-8 text-[12.5px] text-muted-foreground">
          Person not found. <Link to="/people" className="underline">Back</Link>
        </div>
      </AppShell>
    );
  }

  const initials = userInitials(person.firstName, person.lastName);
  const color = avatarColor(person.id);
  const name = fullName(person.firstName, person.lastName);

  const canManage = !!currentUser
    && currentUser.id !== person.id
    && person.role !== "OWNER"
    && (currentUser.role === "OWNER" || currentUser.role === "ADMIN");

  return (
    <AppShell>
      <div className="border-b border-border">
        <div className="px-4 lg:px-8 pt-6">
          <Link to="/people" className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to People
          </Link>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-5">
              <Avatar initials={initials} color={color} size="xl" />
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-[22px] font-semibold tracking-tight">{name}</h1>
                  <StatusBadge status={lastStatus} />
                  {!person.isActive && <Badge tone="warning">Inactive</Badge>}
                </div>
                <div className="mt-1 text-[13px] text-muted-foreground">{person.jobTitle} · {person.department}</div>
                <div className="mt-2 flex items-center gap-4 text-[11.5px] text-muted-foreground">
                  <span>Joined {fmtDateFull(person.createdAt)}</span>
                  {person.manager && <>
                    <span className="text-border">·</span>
                    <span>Manager: {fullName(person.manager.firstName, person.manager.lastName)}</span>
                  </>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary"><MessageSquare className="h-3.5 w-3.5" />Message</Button>
              <Link to="/recognition">
                <Button><Sparkles className="h-3.5 w-3.5" />Recognize</Button>
              </Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 max-w-3xl">
            <QuickStat label="Check-ins" value={checkInsData?.total ?? 0} />
            <QuickStat label="Goals" value={goalsData?.total ?? 0} />
            <QuickStat label="Recognition" value={recognitionsData?.total ?? 0} />
            <QuickStat label="Reviews" value={reviewsData?.total ?? 0} />
          </div>

          {canViewTaskUpdates && workspaceSummary && (
            <div className="mt-3 grid grid-cols-3 gap-3 max-w-3xl">
              <QuickStat label="Workspace: Pending" value={workspaceSummary.pending} />
              <QuickStat label="Workspace: Done" value={workspaceSummary.done} />
              <QuickStat label="Completion %" value={`${workspaceSummary.completionRate}%`} />
            </div>
          )}

          <div className="mt-6 flex items-center gap-1 overflow-x-auto -mx-4 lg:mx-0 px-4 lg:px-0">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${tab === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {t.label}
                {t.count !== undefined && <span className="font-mono-num text-[10.5px] text-muted-foreground">{t.count}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <PageBody className="space-y-5">
        {canManage && (
          <ManageCard
            person={person}
            onChangeRole={(role) => roleMutation.mutate(role)}
            roleUpdating={roleMutation.isPending}
            onChangeStatus={(isActive) => statusMutation.mutate(isActive)}
            statusUpdating={statusMutation.isPending}
            onResetPassword={() => resetPasswordMutation.mutate()}
            resetPending={resetPasswordMutation.isPending}
          />
        )}

        {tab === "overview" && (
          <OverviewTab
            person={person}
            checkIns={checkIns}
            goals={goals}
            recognitions={recognitions}
            reviews={reviews}
            checkInsLoading={checkInsLoading}
            goalsLoading={goalsLoading}
            reviewsLoading={reviewsLoading}
            recognitionsLoading={recognitionsLoading}
          />
        )}
        {tab === "checkins" && <CheckInsList checkIns={checkIns} isLoading={checkInsLoading} />}
        {tab === "goals" && <GoalsList goals={goals} isLoading={goalsLoading} />}
        {tab === "reviews" && <ReviewsList reviews={reviews} isLoading={reviewsLoading} />}
        {tab === "recognition" && <RecognitionList recognitions={recognitions} isLoading={recognitionsLoading} />}
        {tab === "timeline" && <TimelineView items={timeline ?? []} isLoading={timelineLoading} />}
        {tab === "task-updates" && <TaskUpdatesTab activity={taskActivity} isLoading={taskActivityLoading} />}
      </PageBody>
    </AppShell>
  );
}

function QuickStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-card p-3.5">
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono-num text-[20px] font-semibold">{value}</div>
    </div>
  );
}

function OverviewTab({ person, checkIns, goals, recognitions, reviews, checkInsLoading, goalsLoading, reviewsLoading, recognitionsLoading }: {
  person: Person; checkIns: CheckInItem[]; goals: GoalItem[];
  recognitions: RecognitionItem[]; reviews: ReviewItem[];
  checkInsLoading?: boolean; goalsLoading?: boolean; reviewsLoading?: boolean; recognitionsLoading?: boolean;
}) {
  const managerReview = reviews.find(r => r.type === "manager");
  const lastCheckIn = checkIns[0];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader title="Current goals" action={goalsLoading ? undefined : <Badge>{goals.filter(g => g.status === "active").length} active</Badge>} />
          {goalsLoading ? (
            <div className="p-5 space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {goals.filter(g => g.status !== "archived").slice(0, 4).map(g => (
                <li key={g.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-semibold">{g.title}</div>
                      {g.description && <p className="mt-1 text-[12px] text-muted-foreground">{g.description}</p>}
                    </div>
                    <Badge tone={g.status === "completed" ? "success" : "info"}>{g.status}</Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <Progress value={g.progress} className="flex-1" />
                    <span className="font-mono-num text-[12px] font-semibold shrink-0 w-10 text-right">{g.progress}%</span>
                  </div>
                  {g.dueDate && <div className="mt-2 text-[11px] text-muted-foreground">Due {fmtDate(g.dueDate)}</div>}
                </li>
              ))}
              {!goals.length && <li className="p-6 text-[12.5px] text-muted-foreground">No goals yet.</li>}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Latest check-in" />
          {checkInsLoading ? (
            <div className="p-5 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ) : lastCheckIn ? (
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <StatusBadge status={lastCheckIn.status} />
                <span className="text-[11.5px] text-muted-foreground">{relativeTime(lastCheckIn.createdAt)}</span>
              </div>
              <p className="text-[13px] text-foreground leading-relaxed">{lastCheckIn.summary}</p>
              {lastCheckIn.blockers && (
                <div className="mt-3 rounded-md border border-rose-500/20 bg-rose-500/5 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400 mb-1">Blocker</div>
                  <p className="text-[12.5px] text-foreground">{lastCheckIn.blockers}</p>
                </div>
              )}
            </div>
          ) : <div className="p-6 text-[12.5px] text-muted-foreground">No check-ins yet.</div>}
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Latest review" />
          {reviewsLoading ? (
            <div className="p-5 space-y-2">
              <Skeleton className="h-5 w-28 rounded-full" />
              <Skeleton className="h-3 w-full" />
            </div>
          ) : managerReview ? (
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Badge tone="info">Manager · {weekLabel(managerReview.weekStart)}</Badge>
                {managerReview.rating !== null && managerReview.rating !== undefined && (
                  <div className="ml-auto font-mono-num text-[16px] font-semibold">
                    {managerReview.rating}<span className="text-muted-foreground text-[11px]">/5</span>
                  </div>
                )}
              </div>
              {managerReview.feedback && <p className="text-[12.5px] text-foreground leading-relaxed">{managerReview.feedback}</p>}
            </div>
          ) : <div className="p-6 text-[12.5px] text-muted-foreground">No manager review yet.</div>}
        </Card>

        <Card>
          <CardHeader title="Latest recognition" />
          {recognitionsLoading ? (
            <div className="p-5 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-full" />
            </div>
          ) : recognitions[0] ? (
            <div className="p-5">
              <div className="text-[13px] font-medium text-foreground">{recognitions[0].title}</div>
              {recognitions[0].note && <p className="mt-1.5 text-[12px] text-muted-foreground">{recognitions[0].note}</p>}
              <div className="mt-2 text-[11px] text-muted-foreground">
                from {fullName(recognitions[0].author.firstName, recognitions[0].author.lastName)} · {relativeTime(recognitions[0].createdAt)}
              </div>
            </div>
          ) : <div className="p-6 text-[12.5px] text-muted-foreground">No recognition yet.</div>}
        </Card>

        {person.manager && (
          <Card>
            <CardHeader title="Manager" />
            <div className="p-5 flex items-center gap-3">
              <Avatar
                initials={userInitials(person.manager.firstName, person.manager.lastName)}
                color={avatarColor(person.manager.id)}
                size="md"
              />
              <div>
                <div className="text-[13px] font-medium">{fullName(person.manager.firstName, person.manager.lastName)}</div>
                <div className="text-[11px] text-muted-foreground">{person.manager.jobTitle ?? 'Engineering Manager'}</div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function CheckInsList({ checkIns, isLoading }: { checkIns: CheckInItem[]; isLoading?: boolean }) {
  if (isLoading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonListItem key={i} lines={2} />)}</div>;
  if (!checkIns.length) return <EmptyBlock icon={<ClipboardCheck className="h-4 w-4" />} title="No check-ins yet" />;
  return (
    <Card>
      <ul className="divide-y divide-border">
        {checkIns.map(c => (
          <li key={c.id} className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge status={c.status} />
              <span className="text-[11px] text-muted-foreground ml-auto">{relativeTime(c.createdAt)}</span>
            </div>
            <p className="text-[13px] text-foreground">{c.summary}</p>
            {c.blockers && <p className="mt-2 text-[12px] text-rose-600 dark:text-rose-400">Blocker: {c.blockers}</p>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function GoalsList({ goals, isLoading }: { goals: GoalItem[]; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </Card>
        ))}
      </div>
    );
  }
  if (!goals.length) return <EmptyBlock icon={<Target className="h-4 w-4" />} title="No goals set" />;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {goals.map(g => (
        <Card key={g.id} className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="text-[14px] font-semibold">{g.title}</div>
            <Badge tone={g.status === "completed" ? "success" : "info"}>{g.status}</Badge>
          </div>
          {g.description && <p className="mt-1.5 text-[12.5px] text-muted-foreground">{g.description}</p>}
          <div className="mt-4 flex items-center gap-3">
            <Progress value={g.progress} className="flex-1" />
            <span className="font-mono-num text-[12px] font-semibold w-10 text-right">{g.progress}%</span>
          </div>
          {g.dueDate && <div className="mt-2 text-[11px] text-muted-foreground">Due {fmtDate(g.dueDate)}</div>}
        </Card>
      ))}
    </div>
  );
}

function ReviewsList({ reviews, isLoading }: { reviews: ReviewItem[]; isLoading?: boolean }) {
  if (isLoading) return <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <SkeletonListItem key={i} lines={3} />)}</div>;
  if (!reviews.length) return <EmptyBlock icon={<FileText className="h-4 w-4" />} title="No reviews yet" />;
  return (
    <div className="space-y-4">
      {reviews.map(r => (
        <Card key={r.id}>
          <CardHeader
            title={`${r.type === "self" ? "Self review" : "Manager review"} · ${weekLabel(r.weekStart)}`}
            action={r.rating ? <div className="font-mono-num text-[15px] font-semibold">{r.rating}<span className="text-muted-foreground text-[11px]">/5</span></div> : undefined}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
            {r.wins && <ReviewField label="Wins" value={r.wins} />}
            {r.challenges && <ReviewField label="Challenges" value={r.challenges} />}
            {r.learning && <ReviewField label="Learning" value={r.learning} />}
            {r.feedback && <ReviewField label="Feedback" value={r.feedback} />}
          </div>
        </Card>
      ))}
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-5">
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <p className="mt-1.5 text-[13px] text-foreground">{value}</p>
    </div>
  );
}

function RecognitionList({ recognitions, isLoading }: { recognitions: RecognitionItem[]; isLoading?: boolean }) {
  if (isLoading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonListItem key={i} lines={2} />)}</div>;
  if (!recognitions.length) return <EmptyBlock icon={<Sparkles className="h-4 w-4" />} title="No recognition yet" />;
  return (
    <div className="space-y-3">
      {recognitions.map(r => (
        <Card key={r.id} className="p-5">
          <div className="flex items-start gap-3">
            <Avatar initials={userInitials(r.author.firstName, r.author.lastName)} color={avatarColor(r.author.id)} size="md" />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium">
                {fullName(r.author.firstName, r.author.lastName)} <span className="text-muted-foreground font-normal">recognized</span>
              </div>
              <div className="mt-1.5 text-[14px] font-semibold text-foreground">{r.title}</div>
              {r.note && <p className="mt-1.5 text-[12.5px] text-muted-foreground">{r.note}</p>}
              <div className="mt-2 text-[11px] text-muted-foreground">{relativeTime(r.createdAt)}</div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function TimelineView({ items, isLoading }: { items: TimelineItem[]; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <Card className="flex-1 p-4 space-y-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </Card>
          </div>
        ))}
      </div>
    );
  }
  if (!items.length) return <EmptyBlock icon={<ClipboardCheck className="h-4 w-4" />} title="No activity yet" />;

  const iconFor = (type: TimelineItem["type"]) => {
    switch (type) {
      case "check-in": return ClipboardCheck;
      case "goal": return CheckCircle2;
      case "review": return FileText;
      case "recognition": return Sparkles;
      case "task-update": return ListChecks;
    }
  };

  const labelFor = (type: TimelineItem["type"]) => {
    switch (type) {
      case "check-in": return "Submitted check-in";
      case "goal": return "Goal updated";
      case "review": return "Review";
      case "recognition": return "Received recognition";
      case "task-update": return "Posted task update";
    }
  };

  const summaryFor = (item: TimelineItem): string => {
    const d = item.data as Record<string, string>;
    switch (item.type) {
      case "check-in": return d.summary ?? '';
      case "goal": return (d.title as string) ?? '';
      case "review": return (d.wins as string) ?? '';
      case "recognition": return (d.title as string) ?? '';
      case "task-update": return (d.body as string) ?? '';
    }
  };

  return (
    <div className="relative max-w-3xl">
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
      <ul className="space-y-4">
        {items.map((e, i) => {
          const Icon = iconFor(e.type);
          return (
            <li key={i} className="relative flex gap-4 pl-0">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground z-10">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <Card className="flex-1 p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12.5px] font-medium">{labelFor(e.type)}</span>
                  <span className="text-[11px] text-muted-foreground ml-auto">{relativeTime(e.date)}</span>
                </div>
                <div className="mt-1.5 text-[12.5px] text-muted-foreground">{summaryFor(e)}</div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ManageCard({ person, onChangeRole, roleUpdating, onChangeStatus, statusUpdating, onResetPassword, resetPending }: {
  person: Person;
  onChangeRole: (role: "ADMIN" | "MEMBER") => void;
  roleUpdating: boolean;
  onChangeStatus: (isActive: boolean) => void;
  statusUpdating: boolean;
  onResetPassword: () => void;
  resetPending: boolean;
}) {
  const [confirmingStatus, setConfirmingStatus] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  return (
    <Card>
      <CardHeader title="Manage teammate" subtitle="Visible to owners and admins only." />
      <div className="p-5 grid grid-cols-1 gap-5 md:grid-cols-3">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Role</label>
          <select
            value={person.role}
            disabled={roleUpdating}
            onChange={e => onChangeRole(e.target.value as "ADMIN" | "MEMBER")}
            className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
          >
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Account status</label>
          <div className="mt-2">
            {!confirmingStatus ? (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setConfirmingStatus(true)}
                disabled={statusUpdating}
              >
                {person.isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                {person.isActive ? "Deactivate" : "Reactivate"}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setConfirmingStatus(false)}>Cancel</Button>
                <Button
                  className="flex-1"
                  onClick={() => { onChangeStatus(!person.isActive); setConfirmingStatus(false); }}
                  disabled={statusUpdating}
                >
                  {statusUpdating ? "Saving…" : "Confirm"}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Password</label>
          <div className="mt-2">
            {!confirmingReset ? (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setConfirmingReset(true)}
                disabled={resetPending}
              >
                <KeyRound className="h-3.5 w-3.5" />
                Reset password
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setConfirmingReset(false)}>Cancel</Button>
                <Button
                  className="flex-1"
                  onClick={() => { onResetPassword(); setConfirmingReset(false); }}
                  disabled={resetPending}
                >
                  {resetPending ? "Sending…" : "Confirm"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function TaskUpdatesTab({ activity, isLoading }: { activity: UserTaskActivity | null | undefined; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5 space-y-3">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!activity || !activity.issues.length) {
    return (
      <EmptyState
        icon={<Target className="h-5 w-5" />}
        title="No Linear issues assigned"
        description="Once Linear syncs an issue to this person, their progress updates will show up here."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Assigned issues</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {activity.issues.map((issue) => <IssueCard key={issue.id} issue={issue} />)}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Recent updates</h3>
        {!activity.updates.length ? (
          <div className="p-6 text-[12.5px] text-muted-foreground">No updates posted yet.</div>
        ) : (
          <div className="space-y-3">
            {activity.updates.map((u) => <TaskUpdateTimelineItem key={u.id} update={u} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyBlock({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted text-muted-foreground mb-3">{icon}</div>
      <div className="text-[13px] font-semibold">{title}</div>
    </div>
  );
}
