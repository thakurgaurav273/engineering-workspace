import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageBody, Card, CardHeader, Avatar, StatusBadge, Progress, Button, Badge } from "@/components/primitives";
import { getPerson, checkIns, goals, reviews, recognitions } from "@/lib/mock-data";
import { ArrowLeft, Sparkles, Target, ClipboardCheck, FileText, CheckCircle2, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/people/$id")({
  component: PersonPage,
  loader: ({ params }) => {
    const person = getPerson(params.id);
    if (!person) throw notFound();
    return { person };
  },
  notFoundComponent: () => (
    <AppShell>
      <div className="p-8 text-sm text-muted-foreground">Person not found. <Link to="/people" className="underline">Back</Link></div>
    </AppShell>
  ),
});

type Tab = "overview" | "checkins" | "goals" | "reviews" | "recognition" | "timeline";

function PersonPage() {
  const { person } = Route.useLoaderData();
  const [tab, setTab] = useState<Tab>("overview");

  const personCheckIns = checkIns.filter(c => c.personId === person.id);
  const personGoals = goals.filter(g => g.personId === person.id);
  const personReviews = reviews.filter(r => r.personId === person.id);
  const personRecog = recognitions.filter(r => r.recipientId === person.id);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "checkins", label: "Check-ins", count: personCheckIns.length },
    { id: "goals", label: "Goals", count: personGoals.length },
    { id: "reviews", label: "Reviews", count: personReviews.length },
    { id: "recognition", label: "Recognition", count: personRecog.length },
    { id: "timeline", label: "Timeline" },
  ];

  return (
    <AppShell>
      <div className="border-b border-border">
        <div className="px-4 lg:px-8 pt-6">
          <Link to="/people" className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to People
          </Link>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-5">
              <Avatar initials={person.initials} color={person.color} size="xl" />
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-[22px] font-semibold tracking-tight">{person.name}</h1>
                  <StatusBadge status={person.status} />
                </div>
                <div className="mt-1 text-[13px] text-muted-foreground">{person.role} · {person.department} · {person.team}</div>
                <div className="mt-2 flex items-center gap-4 text-[11.5px] text-muted-foreground">
                  <span>Joined {person.joinedDate}</span>
                  <span className="text-border">·</span>
                  <span>Manager: {person.manager}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary"><MessageSquare className="h-3.5 w-3.5" />Message</Button>
              <Button><Sparkles className="h-3.5 w-3.5" />Recognize</Button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 max-w-3xl">
            <QuickStat label="Performance" value={person.performanceScore} />
            <QuickStat label="Check-ins" value={personCheckIns.length} />
            <QuickStat label="Recognition" value={person.recognitionCount} />
            <QuickStat label="Goal completion" value={`${person.goalCompletion}%`} />
          </div>

          <div className="mt-6 flex items-center gap-1 overflow-x-auto -mx-4 lg:mx-0 px-4 lg:px-0">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${tab === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                {t.label}
                {t.count !== undefined && <span className="font-mono-num text-[10.5px] text-muted-foreground">{t.count}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <PageBody>
        {tab === "overview" && <OverviewTab person={person} checkIns={personCheckIns} goals={personGoals} recog={personRecog} reviews={personReviews} />}
        {tab === "checkins" && <CheckInsList checkIns={personCheckIns} />}
        {tab === "goals" && <GoalsList goals={personGoals} />}
        {tab === "reviews" && <ReviewsList reviews={personReviews} />}
        {tab === "recognition" && <RecognitionList recog={personRecog} />}
        {tab === "timeline" && <TimelineView person={person} checkIns={personCheckIns} goals={personGoals} recog={personRecog} reviews={personReviews} />}
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

function OverviewTab({ person, checkIns, goals, recog, reviews }: any) {
  const managerReview = reviews.find((r: any) => r.type === "manager");
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader title="Current goals" action={<Badge>{goals.filter((g: any) => g.status === "active").length} active</Badge>} />
          <ul className="divide-y divide-border">
            {goals.filter((g: any) => g.status !== "archived").slice(0, 4).map((g: any) => (
              <li key={g.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold">{g.title}</div>
                    <p className="mt-1 text-[12px] text-muted-foreground">{g.description}</p>
                  </div>
                  <Badge tone={g.status === "completed" ? "success" : "info"}>{g.status}</Badge>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Progress value={g.progress} className="flex-1" />
                  <span className="font-mono-num text-[12px] font-semibold shrink-0 w-10 text-right">{g.progress}%</span>
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">Due {g.dueDate}</div>
              </li>
            ))}
            {goals.length === 0 && <li className="p-6 text-[12.5px] text-muted-foreground">No goals yet.</li>}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Latest check-in" />
          {checkIns[0] ? (
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <StatusBadge status={checkIns[0].status} />
                <span className="text-[11.5px] text-muted-foreground">{checkIns[0].createdAt}</span>
              </div>
              <p className="text-[13px] text-foreground leading-relaxed">{checkIns[0].summary}</p>
              {checkIns[0].blockers && (
                <div className="mt-3 rounded-md border border-rose-500/20 bg-rose-500/5 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400 mb-1">Blocker</div>
                  <p className="text-[12.5px] text-foreground">{checkIns[0].blockers}</p>
                </div>
              )}
            </div>
          ) : <div className="p-6 text-[12.5px] text-muted-foreground">No check-ins yet.</div>}
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Weekly review" />
          {managerReview ? (
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Badge tone="info">Manager · {managerReview.week}</Badge>
                <div className="ml-auto font-mono-num text-[16px] font-semibold">{managerReview.rating}<span className="text-muted-foreground text-[11px]">/5</span></div>
              </div>
              <p className="text-[12.5px] text-foreground leading-relaxed">{managerReview.feedback}</p>
            </div>
          ) : <div className="p-6 text-[12.5px] text-muted-foreground">No manager review yet.</div>}
        </Card>

        <Card>
          <CardHeader title="Latest recognition" />
          {recog[0] ? (
            <div className="p-5">
              <div className="text-[13px] font-medium text-foreground">{recog[0].title}</div>
              {recog[0].note && <p className="mt-1.5 text-[12px] text-muted-foreground">{recog[0].note}</p>}
              <div className="mt-2 text-[11px] text-muted-foreground">from {getPerson(recog[0].authorId)?.name} · {recog[0].createdAt}</div>
            </div>
          ) : <div className="p-6 text-[12.5px] text-muted-foreground">No recognition yet.</div>}
        </Card>

        <Card>
          <CardHeader title="Manager" />
          <div className="p-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-500 text-white text-[12px] font-semibold">{person.manager.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}</div>
            <div>
              <div className="text-[13px] font-medium">{person.manager}</div>
              <div className="text-[11px] text-muted-foreground">Engineering Manager</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function CheckInsList({ checkIns }: any) {
  if (!checkIns.length) return <EmptyBlock icon={<ClipboardCheck className="h-4 w-4" />} title="No check-ins yet" />;
  return (
    <Card>
      <ul className="divide-y divide-border">
        {checkIns.map((c: any) => (
          <li key={c.id} className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge status={c.status} />
              <span className="text-[11px] text-muted-foreground ml-auto">{c.createdAt}</span>
            </div>
            <p className="text-[13px] text-foreground">{c.summary}</p>
            {c.blockers && <p className="mt-2 text-[12px] text-rose-600 dark:text-rose-400">Blocker: {c.blockers}</p>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function GoalsList({ goals }: any) {
  if (!goals.length) return <EmptyBlock icon={<Target className="h-4 w-4" />} title="No goals set" />;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {goals.map((g: any) => (
        <Card key={g.id} className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="text-[14px] font-semibold">{g.title}</div>
            <Badge tone={g.status === "completed" ? "success" : "info"}>{g.status}</Badge>
          </div>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">{g.description}</p>
          <div className="mt-4 flex items-center gap-3">
            <Progress value={g.progress} className="flex-1" />
            <span className="font-mono-num text-[12px] font-semibold w-10 text-right">{g.progress}%</span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">Due {g.dueDate}</div>
        </Card>
      ))}
    </div>
  );
}

function ReviewsList({ reviews }: any) {
  if (!reviews.length) return <EmptyBlock icon={<FileText className="h-4 w-4" />} title="No reviews yet" />;
  return (
    <div className="space-y-4">
      {reviews.map((r: any) => (
        <Card key={r.id}>
          <CardHeader title={`${r.type === "self" ? "Self review" : "Manager review"} · ${r.week}`} action={<div className="font-mono-num text-[15px] font-semibold">{r.rating}<span className="text-muted-foreground text-[11px]">/5</span></div>} />
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
            <ReviewField label="Wins" value={r.wins} />
            <ReviewField label="Challenges" value={r.challenges} />
            <ReviewField label="Learning" value={r.learning} />
            <ReviewField label="Feedback" value={r.feedback} />
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

function RecognitionList({ recog }: any) {
  if (!recog.length) return <EmptyBlock icon={<Sparkles className="h-4 w-4" />} title="No recognition yet" />;
  return (
    <div className="space-y-3">
      {recog.map((r: any) => {
        const auth = getPerson(r.authorId)!;
        return (
          <Card key={r.id} className="p-5">
            <div className="flex items-start gap-3">
              <Avatar initials={auth.initials} color={auth.color} size="md" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium">{auth.name} <span className="text-muted-foreground font-normal">recognized</span></div>
                <div className="mt-1.5 text-[14px] font-semibold text-foreground">{r.title}</div>
                {r.note && <p className="mt-1.5 text-[12.5px] text-muted-foreground">{r.note}</p>}
                <div className="mt-2 text-[11px] text-muted-foreground">{r.createdAt}</div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function TimelineView({ person, checkIns, goals, recog, reviews }: any) {
  const events = [
    ...checkIns.map((c: any) => ({ type: "checkin", at: c.createdAt, data: c, icon: ClipboardCheck, label: "Submitted check-in" })),
    ...recog.map((r: any) => ({ type: "recog", at: r.createdAt, data: r, icon: Sparkles, label: "Received recognition" })),
    ...goals.filter((g: any) => g.status === "completed").map((g: any) => ({ type: "goal", at: g.dueDate, data: g, icon: CheckCircle2, label: "Completed goal" })),
    ...reviews.map((r: any) => ({ type: "review", at: r.week, data: r, icon: FileText, label: `${r.type === "self" ? "Self" : "Manager"} review` })),
  ];

  return (
    <div className="relative max-w-3xl">
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
      <ul className="space-y-4">
        {events.map((e, i) => (
          <li key={i} className="relative flex gap-4 pl-0">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground z-10">
              <e.icon className="h-3.5 w-3.5" />
            </div>
            <Card className="flex-1 p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[12.5px] font-medium">{e.label}</span>
                <span className="text-[11px] text-muted-foreground ml-auto">{e.at}</span>
              </div>
              <div className="mt-1.5 text-[12.5px] text-muted-foreground">
                {e.type === "checkin" && e.data.summary}
                {e.type === "recog" && e.data.title}
                {e.type === "goal" && e.data.title}
                {e.type === "review" && `${e.data.feedback}`}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyBlock({ icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted text-muted-foreground mb-3">{icon}</div>
      <div className="text-[13px] font-semibold">{title}</div>
    </div>
  );
}
