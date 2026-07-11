import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Users, Package, Link2 } from "lucide-react";
import { Badge, Button, Skeleton } from "@grovyn/ui/primitives";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@grovyn/ui/components/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@grovyn/ui/components/alert-dialog";
import { toast } from "sonner";
import { api } from "@/shared/lib/api";

// Shared detail + edit + lifecycle view for a tenant/organization, opened from the Tenants and
// Organizations directories. SUPER_ADMIN only (backend enforced). Suspending a tenant blocks its
// users from signing in.

interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED";
  description: string | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  linearWorkspaceName: string | null;
  linearConnectedAt: string | null;
  memberCount: number;
  userCount: number;
  appCount: number;
}

export function OrgDetailDialog({ orgId, onClose }: { orgId: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const open = !!orgId;
  const [confirmSuspend, setConfirmSuspend] = useState(false);

  const { data: org, isLoading } = useQuery<OrgDetail>({
    queryKey: ["platform", "organization", orgId],
    queryFn: () => api.get(`/platform/organizations/${orgId}`),
    enabled: open,
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  useEffect(() => {
    if (org) {
      setName(org.name ?? "");
      setDescription(org.description ?? "");
    }
  }, [org]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["platform", "organizations"] });
    queryClient.invalidateQueries({ queryKey: ["platform", "organization", orgId] });
  };

  const saveMutation = useMutation({
    mutationFn: (body: { name: string; description: string }) =>
      api.patch(`/platform/organizations/${orgId}`, body),
    onSuccess: () => {
      invalidate();
      toast.success("Organization updated");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't update organization"),
  });

  const statusMutation = useMutation({
    mutationFn: (next: "suspend" | "activate") =>
      api.post(`/platform/organizations/${orgId}/${next}`),
    onSuccess: (_res, next) => {
      invalidate();
      toast.success(next === "suspend" ? "Tenant suspended" : "Tenant reactivated");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't change status"),
  });

  const dirty = !!org && (name.trim() !== (org.name ?? "") || description.trim() !== (org.description ?? ""));
  const suspended = org?.status === "SUSPENDED";

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{org?.name ?? "Organization"}</DialogTitle>
            <DialogDescription>{org ? `@${org.slug}` : "Tenant details"}</DialogDescription>
          </DialogHeader>

          {isLoading || !org ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={suspended ? "warning" : "success"}>{suspended ? "Suspended" : "Active"}</Badge>
                <Badge tone="neutral"><Users className="h-3 w-3" />{org.memberCount} members</Badge>
                <Badge tone="neutral"><Package className="h-3 w-3" />{org.appCount} apps</Badge>
                {org.linearWorkspaceName && (
                  <Badge tone="info"><Link2 className="h-3 w-3" />{org.linearWorkspaceName}</Badge>
                )}
                <span className="text-[12px] text-muted-foreground">
                  Created {new Date(org.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div>
                <label htmlFor="od-name" className="mb-1 block text-[12px] font-medium text-muted-foreground">Name</label>
                <input
                  id="od-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </div>
              <div>
                <label htmlFor="od-desc" className="mb-1 block text-[12px] font-medium text-muted-foreground">Description</label>
                <textarea
                  id="od-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
            {org && (
              <Button
                variant={suspended ? "secondary" : "outline"}
                size="sm"
                disabled={statusMutation.isPending}
                onClick={() => (suspended ? statusMutation.mutate("activate") : setConfirmSuspend(true))}
                className={suspended ? undefined : "text-rose-600 dark:text-rose-400"}
              >
                {suspended ? "Reactivate tenant" : "Suspend tenant"}
              </Button>
            )}
            <Button
              size="sm"
              disabled={!dirty || saveMutation.isPending}
              onClick={() => saveMutation.mutate({ name: name.trim(), description: description.trim() })}
            >
              {saveMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmSuspend} onOpenChange={setConfirmSuspend}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend {org?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Every user in this tenant will be blocked from signing in until it is reactivated.
              Platform super-admins are unaffected. Their data is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                statusMutation.mutate("suspend");
                setConfirmSuspend(false);
              }}
            >
              Suspend tenant
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
