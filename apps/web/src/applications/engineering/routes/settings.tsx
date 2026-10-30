import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/platform/shell/app-shell";
import { PageHeader, PageBody, Card, CardHeader, Button, Skeleton } from "@grovyn/ui/primitives";
import { api } from "@/shared/lib/api";
import { isAuthenticated, updateStoredUser, type AuthUser } from "@/platform/auth/auth";
import { userInitials, avatarColor, fmtDateFull } from "@grovyn/utils";
import { useTheme, type Theme } from "@/shared/lib/theme";
import { AdministrationSection } from "@/applications/engineering/components/settings/administration-section";
import { AppAccessMatrix } from "@/shared/components/app-access-matrix";
import { AvatarUploader } from "@/components/avatar-uploader";
import { SignatureUploader } from "@/components/signature-uploader";
import { uploadOrgLogo } from "@/shared/lib/uploads";
import { notificationsApi, type NotificationPreferences } from "@/shared/lib/notifications";
import { useApplication } from "@/platform/registry/application-context";
import { LAUNCHER_KEY } from "@/platform/registry/landing";
import { brand } from "@/shared/lib/brand";

interface UserPreference {
  timezone: string;
  emailNotifications: boolean;
  theme: string;
  dailyCheckinReminder: boolean;
  weeklyReviewReminder: boolean;
  reminderTime: string;
  weeklyReviewReminderDay: number;
  autoShareRecognition: boolean;
  defaultApplicationKey?: string | null;
}

const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const sections = [
  { id: "profile", label: "Profile" },
  { id: "preferences", label: "Preferences" },
  { id: "appearance", label: "Appearance" },
  { id: "notifications", label: "Notifications" },
  { id: "integrations", label: "Integrations" },
  { id: "organization", label: "Organization" },
  { id: "app-access", label: "App Access" },
  { id: "administration", label: "Administration" },
] as const;

export function SettingsPage() {
  const [active, setActive] = useState<(typeof sections)[number]["id"]>("profile");
  const queryClient = useQueryClient();
  const { applications } = useApplication();

  const { data: me } = useQuery<AuthUser>({
    queryKey: ["auth", "me"],
    queryFn: () => api.get("/auth/me"),
    enabled: isAuthenticated(),
  });

  const isOwnerOrAdmin = me?.role === "OWNER" || me?.role === "ADMIN";
  const isOwner = me?.role === "OWNER";
  const canManageIntegrations = isOwnerOrAdmin;
  const adminOnlySectionIds: (typeof sections)[number]["id"][] = [
    "integrations",
    "app-access",
    "administration",
  ];
  const ownerOnlySectionIds: (typeof sections)[number]["id"][] = ["organization"];
  const visibleSections = sections.filter((s) => {
    if (ownerOnlySectionIds.includes(s.id)) return isOwner;
    if (adminOnlySectionIds.includes(s.id)) return isOwnerOrAdmin;
    return true;
  });

  const { data: pref } = useQuery<UserPreference>({
    queryKey: ["preference", me?.id],
    queryFn: () => api.get(`/users/${me!.id}/preference`),
    enabled: isAuthenticated() && !!me?.id,
  });

  const prefMutation = useMutation({
    mutationFn: (patch: Partial<UserPreference>) => api.patch(`/users/${me!.id}/preference`, patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ["preference", me?.id] });
      const previous = queryClient.getQueryData<UserPreference>(["preference", me?.id]);
      queryClient.setQueryData(["preference", me?.id], (old: UserPreference | undefined) =>
        old ? { ...old, ...patch } : old,
      );
      return { previous };
    },
    onError: (err: Error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(["preference", me?.id], context.previous);
      toast.error(err.message);
    },
    onSuccess: () => toast.success("Preference saved"),
  });

  // Notification toggles live on a separate model (NotificationPreferences, via
  // /notifications/preferences) from the rest of this page's UserPreference-backed
  // toggles - it's the one that actually gates push notifications. Same query key as
  // useNotificationPreferences (src/hooks/use-notifications.ts) so both surfaces share
  // one cache entry.
  const NOTIF_PREF_KEY = ["notifications", "preferences"];
  const { data: notifPref } = useQuery<NotificationPreferences>({
    queryKey: NOTIF_PREF_KEY,
    queryFn: () => notificationsApi.getPreferences(),
    enabled: isAuthenticated(),
  });

  const notifPrefMutation = useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) =>
      notificationsApi.updatePreferences(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: NOTIF_PREF_KEY });
      const previous = queryClient.getQueryData<NotificationPreferences>(NOTIF_PREF_KEY);
      queryClient.setQueryData(NOTIF_PREF_KEY, (old: NotificationPreferences | undefined) =>
        old ? { ...old, ...patch } : old,
      );
      return { previous };
    },
    onError: (err: Error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(NOTIF_PREF_KEY, context.previous);
      toast.error(err.message);
    },
    onSuccess: () => toast.success("Preference saved"),
  });

  return (
    <AppShell>
      <PageHeader
        title="Settings"
        description={`Manage your profile, preferences, and how ${brand.name} works for you.`}
      />
      <PageBody className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="space-y-0.5">
          {visibleSections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-[13px] transition-colors ${active === s.id ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent/60"}`}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className="space-y-4">
          {active === "profile" && !me && <ProfileSectionSkeleton />}
          {active === "profile" && me && <ProfileSection me={me} />}
          {active === "preferences" && !pref && <TogglesSkeleton />}
          {active === "notifications" && !notifPref && <TogglesSkeleton />}
          {active === "preferences" && pref && (
            <Card>
              <CardHeader
                title="Preferences"
                subtitle={`Times are in your local timezone (${pref.timezone}).`}
              />
              <div className="p-6 space-y-5">
                <div className="flex items-start justify-between gap-4 py-1">
                  <div className="flex-1">
                    <div className="text-[13px] font-medium">Default application</div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">
                      Where {brand.name} takes you on sign-in and when you open the home route. Choose the
                      launcher to always pick an app yourself.
                    </div>
                    <select
                      value={pref.defaultApplicationKey ?? LAUNCHER_KEY}
                      onChange={(e) =>
                        prefMutation.mutate({
                          defaultApplicationKey:
                            e.target.value === LAUNCHER_KEY ? null : e.target.value,
                        })
                      }
                      className="mt-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] outline-none focus:border-foreground/40"
                    >
                      <option value={LAUNCHER_KEY}>All apps (launcher)</option>
                      {applications.map((app) => (
                        <option key={app.key} value={app.key}>
                          {app.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-start justify-between gap-4 py-1">
                  <div className="flex-1">
                    <div className="text-[13px] font-medium">Daily check-in reminder</div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">
                      Nudge me on weekdays if I haven't checked in yet.
                    </div>
                    {pref.dailyCheckinReminder && (
                      <input
                        type="time"
                        step={300}
                        value={pref.reminderTime}
                        onChange={(e) => prefMutation.mutate({ reminderTime: e.target.value })}
                        className="mt-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] outline-none focus:border-foreground/40"
                      />
                    )}
                  </div>
                  <ToggleSwitch
                    checked={pref.dailyCheckinReminder}
                    onChange={(v) => prefMutation.mutate({ dailyCheckinReminder: v })}
                  />
                </div>
                <div className="flex items-start justify-between gap-4 py-1">
                  <div className="flex-1">
                    <div className="text-[13px] font-medium">Weekly review reminder</div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">
                      Ping me if I have direct reports still needing a weekly review.
                    </div>
                    {pref.weeklyReviewReminder && (
                      <select
                        value={pref.weeklyReviewReminderDay}
                        onChange={(e) =>
                          prefMutation.mutate({ weeklyReviewReminderDay: Number(e.target.value) })
                        }
                        className="mt-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] outline-none focus:border-foreground/40"
                      >
                        {WEEKDAY_LABELS.map((label, day) => (
                          <option key={day} value={day}>
                            {label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <ToggleSwitch
                    checked={pref.weeklyReviewReminder}
                    onChange={(v) => prefMutation.mutate({ weeklyReviewReminder: v })}
                  />
                </div>
                <Toggle
                  label="Share recognition publicly"
                  description="Show recognitions I give in the org-wide feed. Off keeps them just between you and the recipient."
                  checked={pref.autoShareRecognition}
                  onChange={(v) => prefMutation.mutate({ autoShareRecognition: v })}
                />
              </div>
            </Card>
          )}

          {active === "appearance" && <AppearanceSection meId={me?.id} />}

          {active === "notifications" && notifPref && (
            <Card>
              <CardHeader
                title="Notifications"
                subtitle="Controls push notifications only - everything still shows up in your notification bell."
              />
              <div className="p-6 space-y-5">
                <Toggle
                  label="New recognition"
                  description="When a teammate recognizes you."
                  checked={notifPref.recognition}
                  onChange={(v) => notifPrefMutation.mutate({ recognition: v })}
                />
                <Toggle
                  label="Check-in blockers"
                  description="When someone on your team is blocked."
                  checked={notifPref.checkInBlockers}
                  onChange={(v) => notifPrefMutation.mutate({ checkInBlockers: v })}
                />
                <Toggle
                  label="Review requests"
                  description="When a review is assigned to you."
                  checked={notifPref.reviews}
                  onChange={(v) => notifPrefMutation.mutate({ reviews: v })}
                />
                <Toggle
                  label="Weekly digest"
                  description="A summary of your org every Monday morning."
                  checked={notifPref.weeklyDigest}
                  onChange={(v) => notifPrefMutation.mutate({ weeklyDigest: v })}
                />
              </div>
            </Card>
          )}

          {active === "integrations" && canManageIntegrations && <IntegrationsSection />}
          {active === "organization" && isOwner && <OrganizationSection />}
          {active === "app-access" && isOwnerOrAdmin && <AppAccessSection />}
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
    mutationFn: () =>
      api.patch<AuthUser>(`/users/${me.id}`, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        jobTitle: jobTitle.trim() || undefined,
        department: department.trim() || undefined,
      }),
    onSuccess: (updated: AuthUser) => {
      updateStoredUser({ ...me, ...updated });
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      toast.success("Profile updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const avatarMutation = useMutation({
    mutationFn: (avatarUrl: string) => api.patch<AuthUser>(`/users/${me.id}/avatar`, { avatarUrl }),
    onSuccess: (updated: AuthUser) => {
      updateStoredUser({ ...me, ...updated });
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      toast.success("Avatar updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const signatureMutation = useMutation({
    mutationFn: (signatureUrl: string) =>
      api.patch<AuthUser>(`/users/${me.id}/signature`, { signatureUrl: signatureUrl || null }),
    onSuccess: (updated: AuthUser) => {
      updateStoredUser({ ...me, ...updated });
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      toast.success("Signature updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const passwordMutation = useMutation({
    mutationFn: () => api.post("/auth/change-password", { currentPassword, newPassword }),
    onSuccess: () => {
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleChangePassword = () => {
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }
    passwordMutation.mutate();
  };

  return (
    <>
      <Card>
        <CardHeader title="Profile" subtitle={`How your teammates see you across ${brand.name}.`} />
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <AvatarUploader
              userId={me.id}
              initials={userInitials(firstName, lastName)}
              color={avatarColor(me.id)}
              currentUrl={me.avatarUrl}
              onUploaded={async (url) => {
                await avatarMutation.mutateAsync(url);
              }}
              saving={avatarMutation.isPending}
            />
            <div className="text-[12.5px] text-muted-foreground">{me.email}</div>
          </div>
          <div className="space-y-2 border-t border-border pt-5">
            <div className="text-[12.5px] font-medium">Signature</div>
            <SignatureUploader
              userId={me.id}
              currentUrl={me.signatureUrl}
              onChange={async (url) => {
                await signatureMutation.mutateAsync(url);
              }}
              saving={signatureMutation.isPending}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="First name" value={firstName} onChange={setFirstName} />
            <Field label="Last name" value={lastName} onChange={setLastName} />
            <Field
              label="Job title"
              value={jobTitle}
              onChange={setJobTitle}
              placeholder="e.g. Engineering Manager"
            />
            <Field
              label="Department"
              value={department}
              onChange={setDepartment}
              placeholder="e.g. Platform"
            />
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
          <Field
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={setCurrentPassword}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="New password"
              type="password"
              value={newPassword}
              onChange={setNewPassword}
            />
            <Field
              label="Confirm new password"
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
            />
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["preference", meId] }),
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
        <div className="text-[12.5px] text-muted-foreground">
          Choose how {brand.name} looks on this device.
        </div>
        <div className="grid grid-cols-3 gap-3 max-w-md">
          {options.map((o) => (
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
    queryKey: ["integrations", "linear", "status"],
    queryFn: () => api.get("/integrations/linear/status"),
    enabled: isAuthenticated(),
  });

  const connectMutation = useMutation({
    mutationFn: () =>
      api.post<{ connected: boolean; workspaceName: string; connectedAsName: string }>(
        "/integrations/linear/connect",
        { apiKey: apiKey.trim() },
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "linear", "status"] });
      // Connecting Linear swaps the sidebar's Issues entry for Task Updates (and back).
      queryClient.invalidateQueries({ queryKey: ["issues", "mode"] });
      toast.success(`Connected to ${data.workspaceName} as ${data.connectedAsName}`);
      setApiKey("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.delete("/integrations/linear"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "linear", "status"] });
      // Connecting Linear swaps the sidebar's Issues entry for Task Updates (and back).
      queryClient.invalidateQueries({ queryKey: ["issues", "mode"] });
      toast.success("Linear disconnected");
      setConfirmingDisconnect(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader
        title="Linear"
        subtitle="Fold completed issues into the leaderboard and performance scoring."
      />
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
                <div className="text-[11.5px] text-muted-foreground mt-0.5">
                  Since {fmtDateFull(status.connectedAt)}
                </div>
              )}
            </div>
            {!confirmingDisconnect ? (
              <Button variant="secondary" size="sm" onClick={() => setConfirmingDisconnect(true)}>
                Disconnect
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirmingDisconnect(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                >
                  {disconnectMutation.isPending ? "Removing…" : "Confirm"}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Personal API key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="lin_api_..."
                className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
              />
              <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                Generate one from Linear → Settings → Security &amp; access → API keys. Any active
                team member's completed issues will be counted automatically - nobody else needs to
                connect their own account.
              </p>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => connectMutation.mutate()}
                disabled={!apiKey.trim() || connectMutation.isPending}
              >
                {connectMutation.isPending ? "Connecting…" : "Connect Linear"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  createdAt: string;
}

/** Initials from an org name: first+last word initials, or the first two letters. */
function orgInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function OrganizationSection() {
  const queryClient = useQueryClient();

  const { data: org } = useQuery<Organization>({
    queryKey: ["organizations", "me"],
    queryFn: () => api.get("/organizations/me"),
    enabled: isAuthenticated(),
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (org) {
      setName(org.name);
      setDescription(org.description ?? "");
    }
  }, [org?.id]);

  // Both the org query and the shared /auth/me query embed org name/logo (the sidebar
  // switcher reads the latter), so refresh both after any change.
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["organizations", "me"] });
    queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      api.patch("/organizations/me", {
        name: name.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      refresh();
      toast.success("Organization updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const logoMutation = useMutation({
    mutationFn: (logoUrl: string) => api.patch("/organizations/me", { logoUrl }),
    onSuccess: () => {
      refresh();
      toast.success("Logo updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!org) return <ProfileSectionSkeleton />;

  return (
    <Card>
      <CardHeader
        title="Organization"
        subtitle={`Your organization's identity across ${brand.name}. Visible to everyone in your workspace.`}
      />
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <AvatarUploader
            userId={org.id}
            initials={orgInitials(org.name)}
            color={avatarColor(org.id)}
            currentUrl={org.logoUrl}
            uploadFn={uploadOrgLogo}
            noun="logo"
            onUploaded={async (url) => {
              await logoMutation.mutateAsync(url);
            }}
            saving={logoMutation.isPending}
          />
          <div className="text-[12.5px] text-muted-foreground">Workspace URL: /{org.slug}</div>
        </div>
        <div className="space-y-4">
          <Field label="Organization name" value={name} onChange={setName} />
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="A short description of what your organization does."
              className="mt-2 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
            />
            <div className="mt-1 text-[10.5px] text-muted-foreground">{description.length}/500</div>
          </div>
        </div>
        <div className="flex justify-end pt-4 border-t border-border">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !name.trim()}
          >
            {saveMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * Organization-scoped App Access, for OWNER/ADMIN. Renders the exact same AppAccessMatrix as
 * Platform Administration, but with no tenant selector - it always operates on the caller's own
 * active organization (the backend defaults to it when no orgId is sent), and the backend rejects
 * any attempt by a non-super-admin to reach another org. Members never see this section.
 */
function AppAccessSection() {
  return (
    <div className="space-y-4">
      <CardHeader
        title="App Access"
        subtitle="Grant or revoke each application per member of your organization. A member sees an app in their launcher only when it's granted here."
      />
      <AppAccessMatrix />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
      />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="mt-2 w-full rounded-md border border-border bg-muted px-3 py-2 text-[13px] text-muted-foreground capitalize">
        {value}
      </div>
    </div>
  );
}

function ProfileSectionSkeleton() {
  return (
    <Card>
      <CardHeader title="Profile" subtitle={`How your teammates see you across ${brand.name}.`} />
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

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div>
        <div className="text-[13px] font-medium">{label}</div>
        <div className="text-[12px] text-muted-foreground mt-0.5">{description}</div>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-foreground" : "bg-muted"}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-background transition-all ${checked ? "left-[18px]" : "left-0.5"}`}
      />
    </button>
  );
}
