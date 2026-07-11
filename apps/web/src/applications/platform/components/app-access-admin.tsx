import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppWindow } from "lucide-react";
import { PageHeader, PageBody, Card, Badge, EmptyState, Skeleton } from "@grovyn/ui/primitives";
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

// Per-user application access matrix, managed by a platform SUPER_ADMIN. Deny-by-default: a
// member sees an installable app only when granted here. Mirrors GET/PUT /platform/app-access.

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

export function AppAccessAdmin() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<AccessMatrix>({
    queryKey: ACCESS_KEY,
    queryFn: () => api.get("/platform/app-access"),
  });

  // Tracks the (userId:appKey) cells with an in-flight toggle, so we can disable just those.
  const [pending, setPending] = useState<Set<string>>(new Set());

  const mutation = useMutation({
    mutationFn: (vars: { userId: string; applicationKey: string; granted: boolean }) =>
      api.put("/platform/app-access", vars),
    onMutate: (vars) => {
      setPending((p) => new Set(p).add(`${vars.userId}:${vars.applicationKey}`));
    },
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ACCESS_KEY });
      // Also refresh the caller's own launcher/nav if they changed their own access.
      queryClient.invalidateQueries({ queryKey: ["platform", "applications"] });
      toast.success(vars.granted ? "Access granted" : "Access revoked");
    },
    onError: () => toast.error("Couldn't update access"),
    onSettled: (_res, _err, vars) => {
      setPending((p) => {
        const next = new Set(p);
        next.delete(`${vars.userId}:${vars.applicationKey}`);
        return next;
      });
    },
  });

  const apps = useMemo(() => data?.applications ?? [], [data]);
  const users = useMemo(() => data?.users ?? [], [data]);

  return (
    <>
      <PageHeader
        title="App Access"
        description="Grant or revoke each application per user. Members see an app only when it is granted. Platform super-admins always see every application."
      />
      <PageBody>
        <Card className="p-0 overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : users.length === 0 || apps.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<AppWindow className="h-5 w-5" />}
                title={apps.length === 0 ? "No installable applications" : "No members yet"}
                description={
                  apps.length === 0
                    ? "There are no user-installable applications to grant."
                    : "Invite members to this organization to manage their app access."
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">User</TableHead>
                    {apps.map((app) => (
                      <TableHead key={app.key} className="text-center whitespace-nowrap">
                        {app.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
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
                          return (
                            <TableCell key={app.key} className="text-center">
                              <Switch
                                checked={granted.has(app.key)}
                                disabled={pending.has(cellKey)}
                                onCheckedChange={(checked) =>
                                  mutation.mutate({
                                    userId: user.id,
                                    applicationKey: app.key,
                                    granted: checked,
                                  })
                                }
                                aria-label={`${granted.has(app.key) ? "Revoke" : "Grant"} ${app.name} for ${user.name || user.email}`}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </PageBody>
    </>
  );
}
