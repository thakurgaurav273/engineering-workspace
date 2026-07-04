import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PageHeader, PageBody, Card, CardHeader, Avatar, Button, Skeleton } from "@/components/primitives";
import { api } from "@/lib/api";
import { isAuthenticated, updateStoredUser, type AuthUser } from "@/lib/auth";
import { userInitials, avatarColor, fmtDateFull } from "@/lib/transforms";
import { useTheme, type Theme } from "@/lib/theme";
import { AdministrationSection } from "@/components/settings/administration-section";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

interface UserPreference {
  timezone: string;
  emailNotifications: boolean;
  weeklyDigest: boolean;
  theme: string;
  dailyCheckinReminder: boolean;
  weeklyReviewReminder: boolean;
  autoShareRecognition: boolean;
  showMenteeSuggestions: boolean;
  notifyNewRecognition: boolean;
  notifyCheckInBlockers: boolean;
  notifyReviewRequests: boolean;
}

const sections = [
  { id: "profile", label: "Profile" },
  { id: "preferences", label: "Preferences" },
  { id: "appearance", label: "Appearance" },
  { id: "notifications", label: "Notifications" },
  { id: "integrations", label: "Integrations" },
  { id: "administration", label: "Administration" },
] as const;

function SettingsPage() {
  const [active, setActive] = useState<(typeof sections)[number]["id"]>("profile");
  const queryClient = useQueryClient();

  const { data: me } = useQuery<AuthUser>({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get('/auth/me'),
    enabled: isAuthenticated(),
  });

  const isOwnerOrAdmin = me?.role === "OWNER" || me?.role === "ADMIN";
  const canManageIntegrations = isOwnerOrAdmin;
  const adminOnlySectionIds: (typeof sections)[number]["id"][] = ["integrations", "administration"];
  const visibleSections = sections.filter(s => !adminOnlySectionIds.includes(s.id) || isOwnerOrAdmin);

  const { data: pref } = useQuery<UserPreference>({
    queryKey: ['preference', me?.id],
    queryFn: () => api.get(`/users/${me!.id}/preference`),
    enabled: isAuthenticated() && !!me?.id,
  });

  const prefMutation = useMutation({
    mutationFn: (patch: Partial<UserPreference>) => api.patch(`/users/${me!.id}/preference`, patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ['preference', me?.id] });
      const previous = queryClient.getQueryData<UserPreference>(['preference', me?.id]);
      queryClient.setQueryData(['preference', me?.id], (old: UserPreference | undefined) => old ? { ...old, ...patch } : old);
      return { previous };
    },
    onError: (err: Error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(['preference', me?.id], context.previous);
      toast.error(err.message);
    },
    onSuccess: () => toast.success("Preference saved"),
  });

  return (
    <AppShell>
      <PageHeader title="Settings" description="Manage your profile, preferences, and how Grovyn works for you." />
      <PageBody className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="space-y-0.5">
          {visibleSections.map(s => (
            <button key={s.id} onClick={() => setActive(s.id)} className={`w-full text-left px-3 py-2 rounded-md text-[13px] transition-colors ${active === s.id ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent/60"}`}>
              {s.label}
            </button>
          ))}
        </nav>

        <div className="space-y-4">
          {active === "profile" && !me && <ProfileSectionSkeleton />}
          {active === "profile" && me && <ProfileSection me={me} />}
          {(active === "preferences" || active === "notifications") && !pref && <TogglesSkeleton />}
          {active === "preferences" && pref && (
            <Card>
              <CardHeader title="Preferences" />
              <div className="p-6 space-y-5">
                <Toggle
                  label="Daily check-in reminder"
                  description="Nudge me at 4:30pm on weekdays."
                  checked={pref.dailyCheckinReminder}
                  onChange={(v) => prefMutation.mutate({ dailyCheckinReminder: v })}
                />
                <Toggle
                  label="Weekly review reminder"
                  description="Ping me every Friday morning."
                  checked={pref.weeklyReviewReminder}
                  onChange={(v) => prefMutation.mutate({ weeklyReviewReminder: v })}
                />
                <Toggle
                  label="Auto-share recognition to team channel"
                  description="Post to #recognition when I recognize someone."
                  checked={pref.autoShareRecognition}
                  onChange={(v) => prefMutation.mutate({ autoShareRecognition: v })}
                />
                <Toggle
                  label="Show mentee suggestions"
                  description="Suggest engineers I could mentor based on shared goals."
                  checked={pref.showMenteeSuggestions}
                  onChange={(v) => prefMutation.mutate({ showMenteeSuggestions: v })}
                />
              </div>
            </Card>
          )}

          {active === "appearance" && <AppearanceSection meId={me?.id} />}

          {active === "notifications" && pref && (
            <Card>
              <CardHeader title="Notifications" />
              <div className="p-6 space-y-5">
                <Toggle
                  label="New recognition"
                  description="When a teammate recognizes you."
                  checked={pref.notifyNewRecognition}
                  onChange={(v) => prefMutation.mutate({ notifyNewRecognition: v })}
                />
                <Toggle
                  label="Check-in blockers"
                  description="When someone on your team is blocked."
                  checked={pref.notifyCheckInBlockers}
                  onChange={(v) => prefMutation.mutate({ notifyCheckInBlockers: v })}
                />
                <Toggle
                  label="Review requests"
                  description="When a review is assigned to you."
                  checked={pref.notifyReviewRequests}
                  onChange={(v) => prefMutation.mutate({ notifyReviewRequests: v })}
                />
                <Toggle
                  label="Weekly digest"
                  description="A summary of your org every Monday morning."
                  checked={pref.weeklyDigest}
                  onChange={(v) => prefMutation.mutate({ weeklyDigest: v })}
                />
              </div>
            </Card>
          )}

          {active === "integrations" && canManageIntegrations && <IntegrationsSection />}
          {active === "administration" && isOwnerOrAdmin && <AdministrationSection />}
        </div>
      </PageBody>
    </AppShell>
  );
}

function ProfileSection({ me }: { me: AuthUser }) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState(me.firstName);
  const [lastName, setLastName] = useState(me.lastName);
  const [jobTitle, setJobTitle] = useState(me.jobTitle ?? "");
  const [department, setDepartment] = useState(me.department ?? "");

  useEffect(() => {
    setFirstName(me.firstName);
    setLastName(me.lastName);
    setJobTitle(me.jobTitle ?? "");
    setDepartment(me.department ?? "");
  }, [me.id]);

  const saveMutation = useMutation({
    mutationFn: () => api.patch<AuthUser>(`/users/${me.id}`, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      jobTitle: jobTitle.trim() || undefined,
      department: department.trim() || undefined,
    }),
    onSuccess: (updated: AuthUser) => {
      updateStoredUser({ ...me, ...updated });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      toast.success("Profile updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const passwordMutation = useMutation({
    mutationFn: () => api.post('/auth/change-password', { currentPassword, newPassword }),
    onSuccess: () => {
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleChangePassword = () => {
    if (newPassword.length < 8) { toast.error("New password must be at least 8 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("New passwords don't match"); return; }
    passwordMutation.mutate();
  };

  return (
    <>
      <Card>
        <CardHeader title="Profile" subtitle="How your teammates see you across Grovyn." />
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Avatar initials={userInitials(firstName, lastName)} color={avatarColor(me.id)} size="xl" />
            <div className="text-[12.5px] text-muted-foreground">{me.email}</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="First name" value={firstName} onChange={setFirstName} />
            <Field label="Last name" value={lastName} onChange={setLastName} />
            <Field label="Job title" value={jobTitle} onChange={setJobTitle} placeholder="e.g. Engineering Manager" />
            <Field label="Department" value={department} onChange={setDepartment} placeholder="e.g. Platform" />
            <ReadOnlyField label="Role" value={me.role} />
            <ReadOnlyField label="Joined" value={fmtDateFull(me.createdAt)} />
          </div>
          <div className="flex justify-end pt-4 border-t border-border">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Change password" subtitle="Use at least 8 characters." />
        <div className="p-6 space-y-4">
          <Field label="Current password" type="password" value={currentPassword} onChange={setCurrentPassword} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="New password" type="password" value={newPassword} onChange={setNewPassword} />
            <Field label="Confirm new password" type="password" value={confirmPassword} onChange={setConfirmPassword} />
          </div>
          <div className="flex justify-end pt-4 border-t border-border">
            <Button onClick={handleChangePassword} disabled={passwordMutation.isPending}>
              {passwordMutation.isPending ? "Updating…" : "Update password"}
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}

function AppearanceSection({ meId }: { meId?: string }) {
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();

  const themeMutation = useMutation({
    mutationFn: (t: Theme) => api.patch(`/users/${meId}/preference`, { theme: t }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['preference', meId] }),
  });

  const options: { id: Theme; label: string }[] = [
    { id: "system", label: "System" },
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
  ];

  const choose = (t: Theme) => {
    setTheme(t);
    if (meId) themeMutation.mutate(t);
  };

  return (
    <Card>
      <CardHeader title="Appearance" />
      <div className="p-6 space-y-4">
        <div className="text-[12.5px] text-muted-foreground">Choose how Grovyn looks on this device.</div>
        <div className="grid grid-cols-3 gap-3 max-w-md">
          {options.map(o => (
            <button
              key={o.id}
              onClick={() => choose(o.id)}
              className={`rounded-md border p-3 cursor-pointer text-[12.5px] font-medium transition-colors ${theme === o.id ? "border-foreground bg-accent" : "border-border hover:bg-accent/50"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

interface LinearStatus {
  connected: boolean;
  workspaceName: string | null;
  connectedAt: string | null;
}

function IntegrationsSection() {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  const { data: status, isLoading: statusLoading } = useQuery<LinearStatus>({
    queryKey: ['integrations', 'linear', 'status'],
    queryFn: () => api.get('/integrations/linear/status'),
    enabled: isAuthenticated(),
  });

  const connectMutation = useMutation({
    mutationFn: () => api.post<{ connected: boolean; workspaceName: string; connectedAsName: string }>(
      '/integrations/linear/connect',
      { apiKey: apiKey.trim() },
    ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'linear', 'status'] });
      toast.success(`Connected to ${data.workspaceName} as ${data.connectedAsName}`);
      setApiKey("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.delete('/integrations/linear'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'linear', 'status'] });
      toast.success("Linear disconnected");
      setConfirmingDisconnect(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader title="Linear" subtitle="Fold completed issues into the leaderboard and performance scoring." />
      <div className="p-6 space-y-4">
        {statusLoading ? (
          <div className="flex items-center justify-between rounded-md border border-border bg-muted px-4 py-3">
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        ) : status?.connected ? (
          <div className="flex items-center justify-between rounded-md border border-border bg-muted px-4 py-3">
            <div>
              <div className="text-[13px] font-medium flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Connected to {status.workspaceName}
              </div>
              {status.connectedAt && (
                <div className="text-[11.5px] text-muted-foreground mt-0.5">Since {fmtDateFull(status.connectedAt)}</div>
              )}
            </div>
            {!confirmingDisconnect ? (
              <Button variant="secondary" size="sm" onClick={() => setConfirmingDisconnect(true)}>Disconnect</Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setConfirmingDisconnect(false)}>Cancel</Button>
                <Button size="sm" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}>
                  {disconnectMutation.isPending ? "Removing…" : "Confirm"}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Personal API key</label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="lin_api_..."
                className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
              />
              <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                Generate one from Linear → Settings → Security &amp; access → API keys. Any active team member's completed issues will be counted automatically — nobody else needs to connect their own account.
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => connectMutation.mutate()} disabled={!apiKey.trim() || connectMutation.isPending}>
                {connectMutation.isPending ? "Connecting…" : "Connect Linear"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
      />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="mt-2 w-full rounded-md border border-border bg-muted px-3 py-2 text-[13px] text-muted-foreground capitalize">{value}</div>
    </div>
  );
}

function ProfileSectionSkeleton() {
  return (
    <Card>
      <CardHeader title="Profile" subtitle="How your teammates see you across Grovyn." />
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full shrink-0" />
          <Skeleton className="h-3.5 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function TogglesSkeleton() {
  return (
    <Card>
      <CardHeader title="Loading…" />
      <div className="p-6 space-y-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 py-1">
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-5 w-9 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div>
        <div className="text-[13px] font-medium">{label}</div>
        <div className="text-[12px] text-muted-foreground mt-0.5">{description}</div>
      </div>
      <button onClick={() => onChange(!checked)} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-foreground" : "bg-muted"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-background transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}
