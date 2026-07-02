import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader, PageBody, Card, CardHeader, Avatar, StatusBadge, Button } from "@/components/primitives";
import { checkIns, getPerson, currentUserId, type Status } from "@/lib/mock-data";
import { ClipboardCheck } from "lucide-react";

export const Route = createFileRoute("/checkins")({ component: CheckInsPage });

function CheckInsPage() {
  const [status, setStatus] = useState<Status>("on_track");
  const [summary, setSummary] = useState("");
  const [blockers, setBlockers] = useState("");
  const me = getPerson(currentUserId)!;

  return (
    <AppShell>
      <PageHeader title="Check-ins" description="A daily pulse from every engineer. Simple, fast, honest." />
      <PageBody className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Today's check-ins" action={<span className="text-[11.5px] text-muted-foreground">{checkIns.length} submitted</span>} />
            <ul className="relative">
              <div className="absolute left-[35px] top-6 bottom-6 w-px bg-border" />
              {checkIns.map(c => {
                const p = getPerson(c.personId)!;
                return (
                  <li key={c.id} className="relative flex gap-4 p-5 border-b border-border last:border-0">
                    <Avatar initials={p.initials} color={p.color} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold">{p.name}</span>
                        <span className="text-[11.5px] text-muted-foreground">{p.team}</span>
                        <StatusBadge status={c.status} />
                        <span className="ml-auto text-[11px] text-muted-foreground font-mono-num">{c.createdAt}</span>
                      </div>
                      <p className="mt-2 text-[13px] text-foreground leading-relaxed">{c.summary}</p>
                      {c.blockers && (
                        <div className="mt-3 rounded-md border border-rose-500/20 bg-rose-500/5 p-3">
                          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400 mb-1">Blocker</div>
                          <p className="text-[12.5px]">{c.blockers}</p>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Submit today's check-in" subtitle="Takes about 30 seconds" />
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <Avatar initials={me.initials} color={me.color} size="sm" />
                <div className="text-[12.5px]"><span className="font-medium">{me.name}</span> <span className="text-muted-foreground">· {me.team}</span></div>
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Current status</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(["on_track", "blocked", "completed"] as Status[]).map(s => (
                    <button key={s} onClick={() => setStatus(s)} className={`rounded-md border px-2 py-2 text-[12px] font-medium transition-colors ${status === s ? "border-foreground bg-accent text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
                      <StatusBadge status={s} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Summary</label>
                <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={4} placeholder="What did you work on today?" className="mt-2 w-full rounded-md border border-border bg-background p-3 text-[13px] outline-none focus:border-foreground/40 resize-none" />
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Blockers <span className="text-muted-foreground normal-case font-normal">(optional)</span></label>
                <textarea value={blockers} onChange={e => setBlockers(e.target.value)} rows={2} placeholder="Anything slowing you down?" className="mt-2 w-full rounded-md border border-border bg-background p-3 text-[13px] outline-none focus:border-foreground/40 resize-none" />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-[11px] text-muted-foreground">Auto-posted to your team</span>
                <Button><ClipboardCheck className="h-3.5 w-3.5" />Submit</Button>
              </div>
            </div>
          </Card>
        </div>
      </PageBody>
    </AppShell>
  );
}
