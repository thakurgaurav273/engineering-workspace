import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader, PageBody, Card, Progress, Button, Badge, Avatar } from "@/components/primitives";
import { goals, getPerson } from "@/lib/mock-data";
import { Plus, Archive, Target } from "lucide-react";

export const Route = createFileRoute("/goals")({ component: GoalsPage });

function GoalsPage() {
  const [filter, setFilter] = useState<"active" | "completed" | "archived" | "all">("active");
  const list = goals.filter(g => filter === "all" || g.status === filter);

  return (
    <AppShell>
      <PageHeader
        title="Goals"
        description="Personal and team goals across the engineering org."
        actions={<>
          <Button variant="secondary"><Archive className="h-3.5 w-3.5" />Archived</Button>
          <Button><Plus className="h-3.5 w-3.5" />New goal</Button>
        </>}
      />
      <PageBody className="space-y-5">
        <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5 w-fit">
          {(["active", "completed", "archived", "all"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded text-[12.5px] capitalize transition-colors ${filter === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {f} <span className="font-mono-num text-[10.5px] text-muted-foreground ml-1">{goals.filter(g => f === "all" || g.status === f).length}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map(g => {
            const owner = getPerson(g.personId)!;
            return (
              <Card key={g.id} className="p-5 hover:border-foreground/20 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface"><Target className="h-4 w-4 text-muted-foreground" /></div>
                  <Badge tone={g.status === "completed" ? "success" : g.status === "archived" ? "neutral" : "info"}>{g.status}</Badge>
                </div>
                <div className="mt-4 text-[14px] font-semibold leading-snug">{g.title}</div>
                <p className="mt-1.5 text-[12.5px] text-muted-foreground line-clamp-2">{g.description}</p>
                <div className="mt-5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Progress</span>
                    <span className="font-mono-num text-[13px] font-semibold">{g.progress}%</span>
                  </div>
                  <Progress value={g.progress} />
                </div>
                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar initials={owner.initials} color={owner.color} size="xs" />
                    <span className="text-[11.5px] text-muted-foreground">{owner.name}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono-num">Due {g.dueDate}</span>
                </div>
              </Card>
            );
          })}
        </div>
      </PageBody>
    </AppShell>
  );
}
