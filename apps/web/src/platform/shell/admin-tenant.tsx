"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient, type Query } from "@tanstack/react-query";
import { Building2, ChevronsUpDown, Check } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@grovyn/ui/components/popover";
import { cn } from "@grovyn/utils";
import { api, setActingOrg } from "@/shared/lib/api";

// Cross-tenant context for the Platform Administration app. A super-admin picks which tenant
// (organization) the org-scoped admin pages operate on, once, from a global switcher in the shell
// header. The choice drives the `X-Org-Id` request header (see the api client), so EVERY org-scoped
// admin page - users, roles, app-access, … - acts on the chosen org with no per-page wiring.
//
// `selectedOrgId === undefined` means "my own organization" (the backend default). The override is
// only ever live while the operator is inside the admin center (`/admin`); leaving it re-pins every
// request to their home org, so their normal workspace is never silently rescoped.

export interface AdminTenant {
  id: string;
  name: string;
  slug: string;
  status?: "ACTIVE" | "SUSPENDED";
}

interface AdminTenantContextValue {
  tenants: AdminTenant[];
  selectedOrgId?: string;
  selectedTenant?: AdminTenant;
  setSelectedOrgId: (id?: string) => void;
  isLoading: boolean;
}

const AdminTenantContext = createContext<AdminTenantContextValue | null>(null);

const STORAGE_KEY = "grovyn.admin.actingOrgId";

function readStored(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(STORAGE_KEY) || undefined;
}

function writeStored(id?: string): void {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(STORAGE_KEY, id);
  else window.localStorage.removeItem(STORAGE_KEY);
}

// The operator's own identity/launcher/notifications stay pinned to their home org (those requests
// never carry the override - see the api client), so their cached results must survive a tenant
// switch. Everything else is org-scoped and is dropped so it refetches under the new scope.
function isOrgScopedQuery(query: Query): boolean {
  const [k0, k1] = query.queryKey as unknown[];
  if (k0 === "auth" || k0 === "notifications") return false;
  if (k0 === "platform" && (k1 === "applications" || k1 === "organizations")) return false;
  return true;
}

export function AdminTenantProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const inAdmin = pathname?.startsWith("/admin") ?? false;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<AdminTenant[]>({
    queryKey: ["platform", "organizations"],
    queryFn: () => api.get("/platform/organizations"),
    enabled: inAdmin,
  });
  const tenants = useMemo(() => data ?? [], [data]);

  const [selectedOrgId, setSelectedOrgIdState] = useState<string | undefined>(undefined);

  // Restore the last-viewed tenant on first load (survives a full refresh).
  useEffect(() => {
    const saved = readStored();
    if (saved) setSelectedOrgIdState(saved);
  }, []);

  // The override is live only inside the admin center; outside it, requests use the home org.
  const effective = inAdmin ? selectedOrgId : undefined;
  const applied = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (applied.current === effective) return;
    applied.current = effective;
    setActingOrg(effective);
    // Scope changed: drop org-scoped cached data so every admin screen refetches for `effective`.
    queryClient.resetQueries({ predicate: isOrgScopedQuery });
  }, [effective, queryClient]);

  const setSelectedOrgId = useCallback((id?: string) => {
    setSelectedOrgIdState(id);
    writeStored(id);
  }, []);

  const selectedTenant = tenants.find((t) => t.id === selectedOrgId);

  return (
    <AdminTenantContext.Provider
      value={{ tenants, selectedOrgId, selectedTenant, setSelectedOrgId, isLoading }}
    >
      {children}
    </AdminTenantContext.Provider>
  );
}

export function useAdminTenant(): AdminTenantContextValue {
  const ctx = useContext(AdminTenantContext);
  if (!ctx) throw new Error("useAdminTenant must be used within an AdminTenantProvider");
  return ctx;
}

/** Global dropdown (shell header) to choose which tenant the admin pages operate on. */
export function TenantSelector() {
  const { tenants, selectedOrgId, setSelectedOrgId } = useAdminTenant();
  const [open, setOpen] = useState(false);
  const selected = tenants.find((t) => t.id === selectedOrgId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-[12.5px] text-foreground hover:bg-accent/60 transition-colors"
          aria-label="Select tenant"
        >
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="hidden sm:inline max-w-[160px] truncate">
            {selected?.name ?? "Your organization"}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-1.5">
        <div className="px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          Viewing tenant
        </div>
        <div className="max-h-72 space-y-0.5 overflow-y-auto">
          <button
            onClick={() => {
              setSelectedOrgId(undefined);
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors",
              !selectedOrgId
                ? "bg-accent font-medium text-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <span className="flex-1 truncate">Your organization</span>
            {!selectedOrgId && <Check className="h-3.5 w-3.5 shrink-0" />}
          </button>
          {tenants.map((t) => {
            const active = t.id === selectedOrgId;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedOrgId(t.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors",
                  active
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <span className="min-w-0 flex-1 truncate">
                  {t.name}
                  <span className="ml-1 text-[11px] text-muted-foreground">@{t.slug}</span>
                </span>
                {active && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
