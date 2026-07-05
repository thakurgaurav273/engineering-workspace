import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "./api";
import { getStoredAuth, storeAuth, isAuthenticated, type AuthUser, type OrgSummary } from "./auth";

interface OrganizationContextValue {
  currentOrganization: OrgSummary | null;
  currentRole: AuthUser["role"] | null;
  organizations: OrgSummary[];
  isSwitching: boolean;
  switchOrganization: (orgId: string) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

// Owns org membership/switching state so components never hand-roll organization
// lookups - they read useOrganization() and call switchOrganization(). Backed by the
// same /auth/me query already fetched app-wide, with getStoredAuth() as the
// instant-paint fallback before that resolves.
export function OrganizationProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [isSwitching, setIsSwitching] = useState(false);

  const { data: me } = useQuery<AuthUser>({
    queryKey: ["auth", "me"],
    queryFn: () => api.get("/auth/me"),
    enabled: isAuthenticated(),
  });

  const user = me ?? getStoredAuth()?.user ?? null;
  const organizations = user?.organizations ?? [];
  const currentOrganization = useMemo(
    () => organizations.find((o) => o.id === user?.orgId) ?? null,
    [organizations, user?.orgId],
  );
  const currentRole = user?.role ?? null;

  const switchOrganization = useCallback(
    async (orgId: string) => {
      const stored = getStoredAuth();
      if (!stored) return;
      if (orgId === user?.orgId) return;

      setIsSwitching(true);
      try {
        const data = await api.post<{ accessToken: string; refreshToken: string; user: AuthUser }>(
          "/auth/switch-org",
          { orgId, refreshToken: stored.refreshToken },
        );
        storeAuth(data.accessToken, data.refreshToken, data.user);
        // Seed the fresh /auth/me result first so org-dependent chrome (sidebar,
        // role checks) updates synchronously, then reset every other cached
        // query and *await* the refetch it triggers - callers keep isSwitching
        // true (and the UI stays blocked, see AppShell) until every screen
        // actually has the new org's data, so nothing ever paints a stale
        // previous-org value even for a frame.
        queryClient.setQueryData(["auth", "me"], data.user);
        await queryClient.resetQueries({ predicate: (q) => q.queryKey[0] !== "auth" });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't switch organization");
        throw err;
      } finally {
        setIsSwitching(false);
      }
    },
    [queryClient, user?.orgId],
  );

  const value = useMemo(
    () => ({ currentOrganization, currentRole, organizations, isSwitching, switchOrganization }),
    [currentOrganization, currentRole, organizations, isSwitching, switchOrganization],
  );

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganization(): OrganizationContextValue {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error("useOrganization must be used within an OrganizationProvider");
  return ctx;
}
