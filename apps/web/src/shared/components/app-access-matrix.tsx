"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppWindow, Search, AlertCircle } from "lucide-react";
import { Card, Badge, EmptyState, Skeleton, Button } from "@grovyn/ui/primitives";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@grovyn/ui/components/table";
import { Switch } from "@grovyn/ui/components/switch";
import { api } from "@/shared/lib/api";
import { iconFor } from "@/platform/registry/app-registry";

// The single per-user application-access matrix, shared by Platform Administration (super-admin,
// any org via `orgId`) and Organization Settings (OWNER/ADMIN, own org). Deny-by-default: a member
// sees an installable app only when granted here. Mirrors GET/PUT /platform/app-access. This owns
// the data, the toggle, and its loading/error/empty states - callers own the page/section chrome.

interface AccessApp {
  key: string;
  name: string;
  description: string;
  status: string;
  icon: string;
}

interface AccessUser {
  id: string;
  email: string;
  name: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  grantedKeys: string[];
}

interface AccessMatrix {
  applications: AccessApp[];
  users: AccessUser[];
}

const ACCESS_KEY = ["platform", "app-access"] as const;

interface ToggleVars {
  userId: string;
  applicationKey: string;
  granted: boolean;
}

/**
 * @param orgId Organization to operate on. `undefined` = the caller's own active org (the backend
 *              default). Org OWNER/ADMIN always pass `undefined`; only a super-admin passes an id.
 */
export function AppAccessMatrix({ orgId }: { orgId?: string }) {
  const queryClient = useQueryClient();
  // Scope the cache per org so a super-admin switching tenants doesn't cross wires.
  const queryKey = useMemo(() => [...ACCESS_KEY, orgId ?? "me"], [orgId]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<AccessMatrix>({
    queryKey,
    queryFn: () => api.get(orgId ? `/platform/app-access?orgId=${orgId}` : "/platform/app-access"),
  });

  // Cells with an in-flight toggle, so we disable just those while the request settles.
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const mutation = useMutation({
    mutationFn: (vars: ToggleVars) => api.put("/platform/app-access", { ...vars, orgId }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<AccessMatrix>(queryKey);
      // Optimistic: flip the grant in the cache so the switch responds instantly.
      queryClient.setQueryData<AccessMatrix>(queryKey, (old) =>
        old
          ? {
              ...old,
              users: old.users.map((u) =>
                u.id === vars.userId
                  ? {
                      ...u,
                      grantedKeys: vars.granted
                        ? [...new Set([...u.grantedKeys, vars.applicationKey])]
                        : u.grantedKeys.filter((k) => k !== vars.applicationKey),
                    }
                  : u,
              ),
            }
          : old,
      );
      setPending((p) => new Set(p).add(`${vars.userId}:${vars.applicationKey}`));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error("Couldn't update access");
    },
    onSuccess: (_res, vars) => {
      toast.success(vars.granted ? "Access granted" : "Access revoked");
    },
    onSettled: (_res, _err, vars) => {
      // Reconcile with the server, and refresh the caller's own launcher/nav in case they
      // changed their own access.
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["platform", "applications"] });
      setPending((p) => {
        const next = new Set(p);
        next.delete(`${vars.userId}:${vars.applicationKey}`);
        return next;
      });
    },
  });

  const apps = useMemo(() => data?.applications ?? [], [data]);
  const allUsers = useMemo(() => data?.users ?? [], [data]);
  const users = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allUsers;
    return allUsers.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [allUsers, search]);

  if (isLoading) {
    return (
      <Card className="p-6 space-y-3">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={<AlertCircle className="h-5 w-5" />}
          title="Couldn't load app access"
          description="Something went wrong fetching the access matrix. You may not have permission to manage this organization, or the request failed."
          action={
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          }
        />
      </Card>
    );
  }

  if (allUsers.length === 0 || apps.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={<AppWindow className="h-5 w-5" />}
          title={apps.length === 0 ? "No installable applications" : "No members yet"}
          description={
            apps.length === 0
              ? "There are no user-installable applications to grant."
              : "Invite members to this organization to manage their app access."
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members…"
          aria-label="Search members"
          className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-[13px] outline-none focus:border-foreground/40"
        />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">User</TableHead>
                {apps.map((app) => {
                  const Icon = iconFor(app.icon);
                  return (
                    <TableHead key={app.key} className="text-center whitespace-nowrap">
                      <div className="flex flex-col items-center gap-1">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span>{app.name}</span>
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={apps.length + 1}
                    className="text-center text-[13px] text-muted-foreground py-8"
                  >
                    No members match “{search}”.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => {
                  const granted = new Set(user.grantedKeys);
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{user.name || user.email}</span>
                          <span className="text-[12px] text-muted-foreground">{user.email}</span>
                        </div>
                        <Badge className="mt-1">{user.role}</Badge>
                      </TableCell>
                      {apps.map((app) => {
                        const cellKey = `${user.id}:${app.key}`;
                        const isGranted = granted.has(app.key);
                        return (
                          <TableCell key={app.key} className="text-center">
                            <Switch
                              checked={isGranted}
                              disabled={pending.has(cellKey)}
                              onCheckedChange={(checked) =>
                                mutation.mutate({
                                  userId: user.id,
                                  applicationKey: app.key,
                                  granted: checked,
                                })
                              }
                              aria-label={`${isGranted ? "Revoke" : "Grant"} ${app.name} for ${user.name || user.email}`}
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        {isFetching && (
          <div className="border-t border-border px-4 py-1.5 text-[11px] text-muted-foreground">
            Syncing…
          </div>
        )}
      </Card>
    </div>
  );
}
