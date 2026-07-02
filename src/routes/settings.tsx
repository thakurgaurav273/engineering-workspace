import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader, PageBody, Card, CardHeader, Avatar, Button } from "@/components/primitives";
import { getPerson, currentUserId } from "@/lib/mock-data";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

const sections = [
  { id: "profile", label: "Profile" },
  { id: "preferences", label: "Preferences" },
  { id: "appearance", label: "Appearance" },
  { id: "notifications", label: "Notifications" },
] as const;

function SettingsPage() {
  const [active, setActive] = useState<(typeof sections)[number]["id"]>("profile");
  const me = getPerson(currentUserId)!;

  return (
    <AppShell>
      <PageHeader title="Settings" description="Manage your profile, preferences, and how Grovyn works for you." />
      <PageBody className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="space-y-0.5">
          {sections.map(s => (
            <button key={s.id} onClick={() => setActive(s.id)} className={`w-full text-left px-3 py-2 rounded-md text-[13px] transition-colors ${active === s.id ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent/60"}`}>
              {s.label}
            </button>
          ))}
        </nav>

        <div className="space-y-4">
          {active === "profile" && (
            <Card>
              <CardHeader title="Profile" subtitle="How your teammates see you across Grovyn." />
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-4">
                  <Avatar initials={me.initials} color={me.color} size="xl" />
                  <div>
                    <Button variant="secondary">Upload photo</Button>
                    <p className="mt-1.5 text-[11.5px] text-muted-foreground">PNG or JPG. Max 2MB.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Full name" value={me.name} />
                  <Field label="Role" value={me.role} />
                  <Field label="Team" value={me.team} />
                  <Field label="Manager" value={me.manager} />
                  <Field label="Email" value="priya@grovyn.com" />
                  <Field label="Joined" value={me.joinedDate} />
                </div>
                <div className="flex justify-end pt-4 border-t border-border">
                  <Button>Save changes</Button>
                </div>
              </div>
            </Card>
          )}

          {active === "preferences" && (
            <Card>
              <CardHeader title="Preferences" />
              <div className="p-6 space-y-5">
                <Toggle label="Daily check-in reminder" description="Nudge me at 4:30pm on weekdays." defaultOn />
                <Toggle label="Weekly review reminder" description="Ping me every Friday morning." defaultOn />
                <Toggle label="Auto-share recognition to team channel" description="Post to #recognition when I recognize someone." />
                <Toggle label="Show mentee suggestions" description="Suggest engineers I could mentor based on shared goals." defaultOn />
              </div>
            </Card>
          )}

          {active === "appearance" && (
            <Card>
              <CardHeader title="Appearance" />
              <div className="p-6 space-y-4">
                <div className="text-[12.5px] text-muted-foreground">Toggle theme from the top bar. More options coming soon.</div>
                <div className="grid grid-cols-3 gap-3 max-w-md">
                  {["System", "Light", "Dark"].map((t, i) => (
                    <div key={t} className={`rounded-md border p-3 cursor-pointer text-[12.5px] font-medium ${i === 1 ? "border-foreground" : "border-border"}`}>{t}</div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {active === "notifications" && (
            <Card>
              <CardHeader title="Notifications" />
              <div className="p-6 space-y-5">
                <Toggle label="New recognition" description="When a teammate recognizes you." defaultOn />
                <Toggle label="Check-in blockers" description="When someone on your team is blocked." defaultOn />
                <Toggle label="Review requests" description="When a review is assigned to you." defaultOn />
                <Toggle label="Weekly digest" description="A summary of your org every Monday morning." />
              </div>
            </Card>
          )}
        </div>
      </PageBody>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input defaultValue={value} className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40" />
    </div>
  );
}

function Toggle({ label, description, defaultOn }: { label: string; description: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div>
        <div className="text-[13px] font-medium">{label}</div>
        <div className="text-[12px] text-muted-foreground mt-0.5">{description}</div>
      </div>
      <button onClick={() => setOn(!on)} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-foreground" : "bg-muted"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-background transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}
