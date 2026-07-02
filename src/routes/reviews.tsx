import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader, PageBody, Card, CardHeader, Avatar, Badge, Button } from "@/components/primitives";
import { reviews, getPerson } from "@/lib/mock-data";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/reviews")({ component: ReviewsPage });

function ReviewsPage() {
  return (
    <AppShell>
      <PageHeader
        title="Reviews"
        description="Weekly self and manager reviews. Structured, low-friction, and honest."
        actions={<Button><Plus className="h-3.5 w-3.5" />New review</Button>}
      />
      <PageBody className="space-y-4">
        {reviews.map(r => {
          const p = getPerson(r.personId)!;
          return (
            <Card key={r.id}>
              <CardHeader
                title={`${r.type === "self" ? "Self review" : "Manager review"} · ${r.week}`}
                subtitle={p.name + " · " + p.role}
                action={
                  <div className="flex items-center gap-3">
                    <Avatar initials={p.initials} color={p.color} size="sm" />
                    <Badge tone={r.type === "manager" ? "info" : "neutral"}>{r.type}</Badge>
                    <div className="font-mono-num text-[16px] font-semibold">{r.rating}<span className="text-muted-foreground text-[11px]">/5</span></div>
                  </div>
                }
              />
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                <Field label="Wins" value={r.wins} />
                <Field label="Challenges" value={r.challenges} />
                <Field label="Learning" value={r.learning} />
                <Field label="Feedback" value={r.feedback} />
              </div>
            </Card>
          );
        })}
      </PageBody>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-5">
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <p className="mt-1.5 text-[13px] text-foreground leading-relaxed">{value}</p>
    </div>
  );
}
