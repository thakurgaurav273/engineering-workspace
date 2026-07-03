import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "@/lib/api";
import { storeAuth, type AuthUser } from "@/lib/auth";
import { registerCurrentDevice } from "@/lib/notifications";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const data = await api.post<{ accessToken: string; refreshToken: string; user: AuthUser }>(
        "/auth/login",
        { email: fd.get("email"), password: fd.get("password") },
      );
      storeAuth(data.accessToken, data.refreshToken, data.user);
      void registerCurrentDevice();
      navigate({ to: "/" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const slug = (fd.get("orgSlug") as string) ||
      (fd.get("orgName") as string).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    try {
      const data = await api.post<{ accessToken: string; refreshToken: string; user: AuthUser }>(
        "/auth/register",
        {
          email: fd.get("email"),
          password: fd.get("password"),
          firstName: fd.get("firstName"),
          lastName: fd.get("lastName"),
          organizationName: fd.get("orgName"),
          organizationSlug: slug,
        },
      );
      storeAuth(data.accessToken, data.refreshToken, data.user);
      void registerCurrentDevice();
      navigate({ to: "/" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
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
          <div className="flex rounded-md border border-border p-0.5 gap-0.5">
            {(["login", "register"] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                className={`flex-1 py-1.5 rounded text-[12.5px] font-medium transition-colors capitalize ${mode === m ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
              >
                {m === "login" ? "Sign in" : "Create org"}
              </button>
            ))}
          </div>

          {error && (
            <div className="rounded-md bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-[12.5px] text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <Field label="Email" name="email" type="email" placeholder="you@company.com" />
              <Field label="Password" name="password" type="password" placeholder="••••••••" />
              <SubmitBtn loading={loading}>Sign in</SubmitBtn>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Field label="First name" name="firstName" placeholder="Ava" />
                <Field label="Last name" name="lastName" placeholder="Chen" />
              </div>
              <Field label="Work email" name="email" type="email" placeholder="ava@company.com" />
              <Field label="Password" name="password" type="password" placeholder="Min 8 chars" />
              <Field label="Organization name" name="orgName" placeholder="Acme Engineering" />
              <Field label="Org slug" name="orgSlug" placeholder="acme (auto-generated)" required={false} />
              <SubmitBtn loading={loading}>Create organization</SubmitBtn>
            </form>
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
  label, name, type = "text", placeholder, required = true,
}: {
  label: string; name: string; type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
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
