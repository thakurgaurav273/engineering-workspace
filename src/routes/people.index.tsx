import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader, PageBody, Card, Avatar, StatusBadge, Progress, Button, Badge } from "@/components/primitives";
import { people } from "@/lib/mock-data";
import { Search, SlidersHorizontal, Plus } from "lucide-react";

export const Route = createFileRoute("/people/")({ component: PeoplePage });

function PeoplePage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [role, setRole] = useState<string>("all");

  const filtered = useMemo(() => people.filter(p =>
    (status === "all" || p.status === status) &&
    (role === "all" || p.role === role) &&
    (q === "" || p.name.toLowerCase().includes(q.toLowerCase()) || p.team.toLowerCase().includes(q.toLowerCase()))
  ), [q, status, role]);

  return (
    <AppShell>
      <PageHeader
        title="People"
        description={`${people.length} engineers and interns across your organization.`}
        actions={<>
          <Button variant="secondary"><SlidersHorizontal className="h-3.5 w-3.5" />Filters</Button>
          <Button><Plus className="h-3.5 w-3.5" />Invite</Button>
        </>}
      />
      <PageBody className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 flex-1">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or team" className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground" />
          </div>
          <FilterPills label="Status" value={status} onChange={setStatus} options={[
            { v: "all", l: "All" }, { v: "on_track", l: "On track" }, { v: "blocked", l: "Blocked" }, { v: "completed", l: "Completed" },
          ]} />
          <FilterPills label="Role" value={role} onChange={setRole} options={[
            { v: "all", l: "All" }, { v: "Engineer", l: "Engineer" }, { v: "Senior Engineer", l: "Senior" }, { v: "Staff Engineer", l: "Staff" }, { v: "Engineering Manager", l: "Manager" }, { v: "Intern", l: "Intern" },
          ]} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {filtered.map(p => (
            <Link key={p.id} to="/people/$id" params={{ id: p.id }} className="group">
              <Card className="p-5 hover:border-foreground/20 hover:shadow-sm transition-all">
                <div className="flex items-start gap-3">
                  <Avatar initials={p.initials} color={p.color} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-foreground truncate">{p.name}</div>
                    <div className="text-[12px] text-muted-foreground truncate">{p.role}</div>
                    <div className="mt-1"><Badge>{p.department} · {p.team}</Badge></div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-border">
                  <Stat label="Score" value={p.performanceScore} />
                  <Stat label="Recog." value={p.recognitionCount} />
                  <Stat label="Goals" value={`${p.goalCompletion}%`} />
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                    <span>Goal completion</span>
                    <span className="font-mono-num">{p.goalCompletion}%</span>
                  </div>
                  <Progress value={p.goalCompletion} />
                </div>
                <div className="mt-3 text-[11px] text-muted-foreground">Last check-in {p.lastCheckIn}</div>
              </Card>
            </Link>
          ))}
        </div>
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

function FilterPills({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5">
      <span className="px-2 text-[11px] text-muted-foreground uppercase tracking-wider">{label}</span>
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)} className={`px-2 py-1 rounded text-[12px] transition-colors ${value === o.v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          {o.l}
        </button>
      ))}
    </div>
  );
}
