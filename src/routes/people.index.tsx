import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { PageHeader, PageBody, Card, Avatar, StatusBadge, Progress, Button, Badge } from "@/components/primitives";
import { api } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { avatarColor, userInitials, fullName } from "@/lib/transforms";
import { Search, SlidersHorizontal, Plus } from "lucide-react";
import type { Status } from "@/lib/mock-data";

export const Route = createFileRoute("/people/")({ component: PeoplePage });

interface LeaderboardEntry {
  rank: number;
  user: { id: string; firstName: string; lastName: string; avatarUrl?: string; jobTitle?: string; department?: string };
  checkInScore: number;
  goalScore: number;
  recognitionScore: number;
  totalScore: number;
  trend: string;
}

interface LeaderboardData {
  rankings: LeaderboardEntry[];
}

interface CheckInToday {
  userId: string;
  status: Status;
}

function PeoplePage() {
  const [q, setQ] = useState("");
  const [dept, setDept] = useState<string>("all");

  const { data: leaderboard } = useQuery<LeaderboardData>({
    queryKey: ['leaderboard', 'week'],
    queryFn: () => api.get('/leaderboard?period=week'),
    enabled: isAuthenticated(),
  });

  const { data: todayCheckIns } = useQuery<CheckInToday[]>({
    queryKey: ['checkins', 'today'],
    queryFn: () => api.get('/check-ins/today'),
    enabled: isAuthenticated(),
    select: (data: any[]) => data.map(c => ({ userId: c.user.id, status: c.status })),
  });

  const statusByUser = useMemo(() => {
    const map: Record<string, Status> = {};
    (todayCheckIns ?? []).forEach(c => { map[c.userId] = c.status; });
    return map;
  }, [todayCheckIns]);

  const rankings = leaderboard?.rankings ?? [];

  const departments = useMemo(() => {
    const set = new Set<string>();
    rankings.forEach(r => { if (r.user.department) set.add(r.user.department); });
    return Array.from(set).sort();
  }, [rankings]);

  const filtered = useMemo(() => rankings.filter(r => {
    const name = fullName(r.user.firstName, r.user.lastName).toLowerCase();
    const matchQ = !q || name.includes(q.toLowerCase()) || (r.user.department ?? '').toLowerCase().includes(q.toLowerCase());
    const matchDept = dept === 'all' || r.user.department === dept;
    return matchQ && matchDept;
  }), [rankings, q, dept]);

  return (
    <AppShell>
      <PageHeader
        title="People"
        description={`${rankings.length} engineers across your organization.`}
        actions={<>
          <Button variant="secondary"><SlidersHorizontal className="h-3.5 w-3.5" />Filters</Button>
          <Button><Plus className="h-3.5 w-3.5" />Invite</Button>
        </>}
      />
      <PageBody className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 flex-1">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by name or team"
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            />
          </div>
          <FilterPills
            label="Dept"
            value={dept}
            onChange={setDept}
            options={[{ v: "all", l: "All" }, ...departments.map(d => ({ v: d, l: d }))]}
          />
        </div>

        {!filtered.length ? (
          <div className="py-16 text-center text-[12.5px] text-muted-foreground">No people found.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {filtered.map(entry => {
              const u = entry.user;
              const status: Status = statusByUser[u.id] ?? 'on_track';
              return (
                <Link key={u.id} to="/people/$id" params={{ id: u.id }} className="group">
                  <Card className="p-5 hover:border-foreground/20 hover:shadow-sm transition-all">
                    <div className="flex items-start gap-3">
                      <Avatar initials={userInitials(u.firstName, u.lastName)} color={avatarColor(u.id)} size="lg" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold text-foreground truncate">{fullName(u.firstName, u.lastName)}</div>
                        <div className="text-[12px] text-muted-foreground truncate">{u.jobTitle}</div>
                        <div className="mt-1"><Badge>{u.department}</Badge></div>
                      </div>
                      <StatusBadge status={status} />
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-border">
                      <Stat label="Score" value={entry.totalScore} />
                      <Stat label="Check-in" value={`${entry.checkInScore}%`} />
                      <Stat label="Goals" value={`${entry.goalScore}%`} />
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

function FilterPills({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[];
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5 flex-wrap">
      <span className="px-2 text-[11px] text-muted-foreground uppercase tracking-wider">{label}</span>
      {options.slice(0, 6).map(o => (
        <button key={o.v} onClick={() => onChange(o.v)} className={`px-2 py-1 rounded text-[12px] transition-colors ${value === o.v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          {o.l}
        </button>
      ))}
    </div>
  );
}
