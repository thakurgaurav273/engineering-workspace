import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { storeAuth, type AuthUser } from "@/lib/auth";
import { registerCurrentDevice } from "@/lib/notifications";

export const Route = createFileRoute("/accept-invite")({ component: AcceptInvitePage });

function AcceptInvitePage() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [preview, setPreview] = useState<{ email: string; orgName: string } | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") ?? "";
    setToken(t);
    if (!t) { setPreviewError("This invite link is missing a token."); return; }
    api.get<{ email: string; orgName: string }>(`/invitations/token/${t}`)
      .then(setPreview)
      .catch((err: Error) => setPreviewError(err.message || "This invite link is invalid or has expired."));
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const data = await api.post<{ accessToken: string; refreshToken: string; user: AuthUser }>(
        "/auth/accept-invite",
        {
          token,
          password: fd.get("password"),
          firstName: fd.get("firstName"),
          lastName: fd.get("lastName"),
        },
      );
      storeAuth(data.accessToken, data.refreshToken, data.user);
      void registerCurrentDevice();
      navigate({ to: "/" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to accept invitation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <img src="/grovyn_logo.png" alt="Grovyn" className="h-8 w-8 rounded-md object-contain" />
          <div>
            <div className="text-[15px] font-semibold tracking-tight">Grovyn One</div>
            <div className="text-[11px] text-muted-foreground">Engineering Performance Platform</div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          {previewError ? (
            <div className="rounded-md bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-[12.5px] text-rose-600 dark:text-rose-400">
              {previewError}
            </div>
          ) : !preview ? (
            <div className="text-[12.5px] text-muted-foreground text-center py-4">Loading invitation…</div>
          ) : (
            <>
              <div className="text-[13px] text-muted-foreground text-center">
                You're joining <span className="font-semibold text-foreground">{preview.orgName}</span> as{" "}
                <span className="font-semibold text-foreground">{preview.email}</span>
              </div>

              {error && (
                <div className="rounded-md bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-[12.5px] text-rose-600 dark:text-rose-400">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="First name" name="firstName" placeholder="Ava" />
                  <Field label="Last name" name="lastName" placeholder="Chen" />
                </div>
                <Field label="Password" name="password" type="password" placeholder="Min 8 chars" />
                <SubmitBtn loading={loading}>Accept invitation</SubmitBtn>
              </form>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-[11.5px] text-muted-foreground">
          Grovyn One · Engineering Performance
        </p>
      </div>
    </div>
  );
}

function Field({
  label, name, type = "text", placeholder,
}: {
  label: string; name: string; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required
        className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40 placeholder:text-muted-foreground/50"
      />
    </div>
  );
}

function SubmitBtn({ children, loading }: { children: React.ReactNode; loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full mt-1 rounded-md bg-foreground text-background py-2 text-[13px] font-semibold transition-opacity disabled:opacity-60"
    >
      {loading ? "Please wait…" : children}
    </button>
  );
}
