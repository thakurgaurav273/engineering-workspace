import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";
import { PageHeader, PageBody, Card, CardHeader, Badge, EmptyState, Skeleton } from "@grovyn/ui/primitives";
import { api } from "@/shared/lib/api";

// Roles catalog (read-only). Sourced from the real SUPER_ADMIN endpoints
// GET /platform/roles and GET /platform/role-permissions. Role/permission editing is
// intentionally out of scope on the backend, so this view does not offer writes.

interface AuthzRole {
  id: string;
  key: string;
  name: string;
  scope: "PLATFORM" | "ORG" | string;
  isSystem: boolean;
  description?: string | null;
}

interface RolePermissions {
  role: string;
  scope: string;
  permissions: string[];
}

export function RolesAdmin() {
  const rolesQuery = useQuery<AuthzRole[]>({
    queryKey: ["platform", "roles"],
    queryFn: () => api.get("/platform/roles"),
  });

  const rolePermsQuery = useQuery<RolePermissions[]>({
    queryKey: ["platform", "role-permissions"],
    queryFn: () => api.get("/platform/role-permissions"),
  });

  const permsByRole = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const rp of rolePermsQuery.data ?? []) map.set(rp.role, rp.permissions ?? []);
    return map;
  }, [rolePermsQuery.data]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const roles = rolesQuery.data ?? [];

  return (
    <>
      <PageHeader title="Roles" description="System and custom roles and the permissions they grant." />
      <PageBody>
        <Card className="p-0 overflow-hidden">
          <CardHeader title="Roles" subtitle="Read-only - role editing lands with the permission engine." />
          {rolesQuery.isLoading ? (
            <div className="p-5 space-y-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-2/3" />
            </div>
          ) : rolesQuery.isError ? (
            <div className="p-6">
              <EmptyState
                icon={<ShieldCheck className="h-5 w-5" />}
                title="Couldn't load roles"
                description="The roles endpoint returned an error. Confirm you have platform super-admin access."
              />
            </div>
          ) : roles.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<ShieldCheck className="h-5 w-5" />}
                title="No roles defined"
                description="No system or custom roles are registered yet."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {roles.map((role) => {
                const perms = permsByRole.get(role.key) ?? [];
                const isOpen = expanded.has(role.key);
                return (
                  <li key={role.id}>
                    <button
                      type="button"
                      onClick={() => toggle(role.key)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-accent/50"
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-foreground">{role.name}</span>
                          <span className="text-[11px] text-muted-foreground">{role.key}</span>
                        </div>
                        {role.description && (
                          <div className="text-[12px] text-muted-foreground">{role.description}</div>
                        )}
                      </div>
                      <Badge tone={role.scope === "PLATFORM" ? "info" : "neutral"} className="shrink-0">
                        {role.scope}
                      </Badge>
                      <Badge tone={role.isSystem ? "warning" : "neutral"} className="shrink-0">
                        {role.isSystem ? "System" : "Custom"}
                      </Badge>
                      <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                        {perms.length} perms
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 pl-12">
                        {perms.length === 0 ? (
                          <p className="text-[12px] text-muted-foreground">No permissions mapped to this role.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {perms.map((p) => (
                              <span
                                key={p}
                                className="rounded-md border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </PageBody>
    </>
  );
}
