"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronsUpDown, Check } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@grovyn/ui/components/popover";
import { cn } from "@grovyn/utils";
import { api } from "@/shared/lib/api";

// Cross-tenant context for the Platform Administration app. A super-admin picks which tenant
// (organization) the org-scoped admin pages operate on. `selectedOrgId === undefined` means "my
// own organization" (the backend default), so nothing breaks before a tenant is chosen.

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

export function AdminTenantProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery<AdminTenant[]>({
    queryKey: ["platform", "organizations"],
    queryFn: () => api.get("/platform/organizations"),
  });
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>(undefined);
  const tenants = data ?? [];
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

/** Dropdown to choose which tenant the org-scoped admin pages operate on. */
export function TenantSelector() {
  const { tenants, selectedOrgId, setSelectedOrgId } = useAdminTenant();
  const [open, setOpen] = useState(false);
  const selected = tenants.find((t) => t.id === selectedOrgId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-foreground hover:bg-accent/60 transition-colors"
          aria-label="Select tenant"
        >
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="max-w-[180px] truncate">{selected?.name ?? "Your organization"}</span>
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
