import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, Metric, Avatar, StatusBadge, Progress, Badge, Button, PageBody, PageHeader } from "@/components/primitives";
import { people, checkIns, recognitions, checkInTrend, weeklyPerformance, goalProgress, getPerson } from "@/lib/mock-data";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from "recharts";
import { Plus, ArrowUpRight, Sparkles, ClipboardCheck, FileText } from "lucide-react";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
  const topContributors = [...people].sort((a, b) => b.performanceScore - a.performanceScore).slice(0, 5);
  const blocked = people.filter(p => p.status === "blocked");

  return (
    <AppShell right={<RightPanel />}>
      <PageHeader
        title="Dashboard"
        description="A snapshot of your engineering org this week."
        actions={<>
          <Button variant="secondary">Export</Button>
          <Button><Plus className="h-3.5 w-3.5" />New check-in</Button>
        </>}
      />
      <PageBody className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Metric label="Check-in rate" value="86%" delta="+4.2%" hint="10 of 12 today" />
          <Metric label="Blocked" value={blocked.length} delta="+1" deltaTone="warning" hint="needs attention" />
          <Metric label="Pending reviews" value="7" delta="-2" hint="due this week" />
          <Metric label="Open goals" value="24" delta="+3" hint="active org-wide" />
          <Metric label="Recognitions" value={recognitions.length} delta="+3" hint="this week" />
          <Metric label="Avg score" value="87.4" delta="+1.8" hint="last 30 days" />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title="Check-in completion" subtitle="Rolling 7 days" action={<Badge tone="info">Weekly</Badge>} />
            <div className="p-4 h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={checkInTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="rate" stroke="var(--color-chart-1)" strokeWidth={2} fill="url(#cg)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardHeader title="Goal progress" subtitle="Across all teams" />
            <div className="p-5 space-y-4">
              {goalProgress.map(g => {
                const total = goalProgress.reduce((s, x) => s + x.value, 0);
                const pct = Math.round((g.value / total) * 100);
                return (
                  <div key={g.name}>
                    <div className="flex items-center justify-between text-[12px] mb-1.5">
                      <span className="text-foreground">{g.name}</span>
                      <span className="font-mono-num text-muted-foreground">{g.value} <span className="text-border">·</span> {pct}%</span>
                    </div>
                    <Progress value={pct} />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title="Weekly performance" subtitle="Team-wide performance score" />
            <div className="p-4 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyPerformance} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} domain={[60, 100]} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="score" fill="var(--color-foreground)" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardHeader title="Top contributors" subtitle="This week" action={<Link to="/leaderboard" className="text-[11.5px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">All <ArrowUpRight className="h-3 w-3" /></Link>} />
            <ul className="p-2">
              {topContributors.map((p, i) => (
                <li key={p.id}>
                  <Link to="/people/$id" params={{ id: p.id }} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent transition-colors">
                    <span className="w-4 text-[11px] font-mono-num text-muted-foreground text-right">{i + 1}</span>
                    <Avatar initials={p.initials} color={p.color} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium truncate">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{p.role}</div>
                    </div>
                    <span className="font-mono-num text-[12.5px] font-semibold">{p.performanceScore}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Recent check-ins" action={<Link to="/checkins" className="text-[11.5px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">View all <ArrowUpRight className="h-3 w-3" /></Link>} />
            <ul className="divide-y divide-border">
              {checkIns.slice(0, 5).map(c => {
                const p = getPerson(c.personId)!;
                return (
                  <li key={c.id} className="flex items-start gap-3 px-5 py-3.5">
                    <Avatar initials={p.initials} color={p.color} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-medium truncate">{p.name}</span>
                        <StatusBadge status={c.status} />
                        <span className="text-[11px] text-muted-foreground ml-auto shrink-0">{c.createdAt}</span>
                      </div>
                      <p className="mt-1 text-[12.5px] text-muted-foreground line-clamp-2">{c.summary}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Recent recognition" action={<Link to="/recognition" className="text-[11.5px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">View all <ArrowUpRight className="h-3 w-3" /></Link>} />
            <ul className="divide-y divide-border">
              {recognitions.slice(0, 5).map(r => {
                const rec = getPerson(r.recipientId)!;
                const auth = getPerson(r.authorId)!;
                return (
                  <li key={r.id} className="flex items-start gap-3 px-5 py-3.5">
                    <Avatar initials={rec.initials} color={rec.color} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-medium truncate">{rec.name}</span>
                        <span className="text-[11.5px] text-muted-foreground">from {auth.name}</span>
                        <span className="text-[11px] text-muted-foreground ml-auto shrink-0">{r.createdAt}</span>
                      </div>
                      <p className="mt-1 text-[12.5px] text-foreground truncate">{r.title}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </PageBody>
    </AppShell>
  );
}

function RightPanel() {
  const blocked = people.filter(p => p.status === "blocked");
  const pendingReviews = people.slice(0, 3);
  return (
    <div className="p-5 space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Blocked members</h3>
          <Badge tone="warning">{blocked.length}</Badge>
        </div>
        <ul className="space-y-2">
          {blocked.map(p => (
            <Link key={p.id} to="/people/$id" params={{ id: p.id }} className="flex items-center gap-2.5 rounded-md p-2 hover:bg-accent transition-colors">
              <Avatar initials={p.initials} color={p.color} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium truncate">{p.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{p.team} · {p.lastCheckIn}</div>
              </div>
              <StatusBadge status={p.status} />
            </Link>
          ))}
        </ul>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Reviews due</h3>
          <Badge>{pendingReviews.length}</Badge>
        </div>
        <ul className="space-y-2">
          {pendingReviews.map(p => (
            <div key={p.id} className="flex items-center gap-2.5 rounded-md p-2 hover:bg-accent transition-colors">
              <Avatar initials={p.initials} color={p.color} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium truncate">{p.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">Weekly review · Fri</div>
              </div>
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quick actions</h3>
        <div className="space-y-2">
          <Link to="/checkins" className="flex items-center gap-2.5 rounded-md border border-border p-2.5 hover:bg-accent transition-colors">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            <span className="text-[12.5px] font-medium">Submit today's check-in</span>
          </Link>
          <Link to="/recognition" className="flex items-center gap-2.5 rounded-md border border-border p-2.5 hover:bg-accent transition-colors">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <span className="text-[12.5px] font-medium">Recognize a teammate</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
