import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader, PageBody, Card, Avatar, Button } from "@/components/primitives";
import { recognitions, getPerson, people } from "@/lib/mock-data";
import { Sparkles, Send } from "lucide-react";

export const Route = createFileRoute("/recognition")({ component: RecognitionPage });

function RecognitionPage() {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [to, setTo] = useState<string>(people[0].id);

  return (
    <AppShell>
      <PageHeader title="Recognition" description="A quiet, thoughtful way to appreciate great work." />
      <PageBody className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          {recognitions.map(r => {
            const rec = getPerson(r.recipientId)!;
            const auth = getPerson(r.authorId)!;
            return (
              <Card key={r.id} className="p-5 hover:border-foreground/15 transition-all">
                <div className="flex items-start gap-4">
                  <Avatar initials={rec.initials} color={rec.color} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13.5px] font-semibold">{rec.name}</span>
                      <span className="text-[12px] text-muted-foreground">recognized by <span className="text-foreground font-medium">{auth.name}</span></span>
                      <span className="ml-auto text-[11px] text-muted-foreground font-mono-num">{r.createdAt}</span>
                    </div>
                    <div className="mt-2 text-[15px] font-semibold text-foreground leading-snug">{r.title}</div>
                    {r.note && <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed">{r.note}</p>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div>
          <Card>
            <div className="p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-md bg-foreground text-background"><Sparkles className="h-4 w-4" /></div>
                <div>
                  <div className="text-[13.5px] font-semibold">Recognize a teammate</div>
                  <div className="text-[11.5px] text-muted-foreground">A short note goes a long way.</div>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">To</label>
                <select value={to} onChange={e => setTo(e.target.value)} className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40">
                  {people.map(p => <option key={p.id} value={p.id}>{p.name} · {p.role}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What did they do well?" className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40" />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Note <span className="text-muted-foreground normal-case font-normal">(optional)</span></label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={4} placeholder="Add a personal message" className="mt-2 w-full rounded-md border border-border bg-background p-3 text-[13px] outline-none focus:border-foreground/40 resize-none" />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-[11px] text-muted-foreground">Shared with the team feed</span>
                <Button><Send className="h-3.5 w-3.5" />Send</Button>
              </div>
            </div>
          </Card>
        </div>
      </PageBody>
    </AppShell>
  );
}
