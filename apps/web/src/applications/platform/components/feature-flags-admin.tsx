import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Flag } from "lucide-react";
import { PageHeader, PageBody, Card, CardHeader, EmptyState, Skeleton } from "@grovyn/ui/primitives";
import { Switch } from "@grovyn/ui/components/switch";
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

// Feature-flag administration (SUPER_ADMIN). Reads the effective flag map and every flag
// referenced by an application manifest from GET /platform/feature-flags, and flips a flag at
// runtime via PUT /platform/feature-flags. Overrides are in-memory per the backend service.

interface FeatureFlag {
  key: string;
  enabled: boolean;
}

interface FeatureFlagList {
  flags: FeatureFlag[];
}

const FLAGS_KEY = ["platform", "feature-flags"] as const;

export function FeatureFlagsAdmin() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery<FeatureFlagList>({
    queryKey: FLAGS_KEY,
    queryFn: () => api.get("/platform/feature-flags"),
  });

  const [pending, setPending] = useState<Set<string>>(new Set());
  // Flag awaiting confirmation before we flip it (guards impactful flags like platform.admin).
  const [confirming, setConfirming] = useState<{ key: string; next: boolean } | null>(null);

  const mutation = useMutation({
    mutationFn: (vars: { key: string; enabled: boolean }) => api.put("/platform/feature-flags", vars),
    onMutate: (vars) => setPending((p) => new Set(p).add(vars.key)),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: FLAGS_KEY });
      // A flag can gate an application's availability, so refresh the launcher/nav too.
      queryClient.invalidateQueries({ queryKey: ["platform", "applications"] });
      toast.success(`Flag "${vars.key}" ${vars.enabled ? "enabled" : "disabled"}`);
    },
    onError: () => toast.error("Couldn't update the flag"),
    onSettled: (_res, _err, vars) =>
      setPending((p) => {
        const next = new Set(p);
        next.delete(vars.key);
        return next;
      }),
  });

  const flags = data?.flags ?? [];

  return (
    <>
      <PageHeader
        title="Feature Flags"
        description="Flip platform, tenant, and application flags at runtime - no redeploy."
      />
      <PageBody>
        <Card className="p-0 overflow-hidden">
          <CardHeader
            title="Flags"
            subtitle="Effective values (env defaults with runtime overrides). Overrides are in-memory until the flag store lands."
          />
          {isLoading ? (
            <div className="p-5 space-y-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-2/3" />
            </div>
          ) : isError ? (
            <div className="p-6">
              <EmptyState
                icon={<Flag className="h-5 w-5" />}
                title="Couldn't load feature flags"
                description="The feature-flags endpoint returned an error. Confirm platform super-admin access."
              />
            </div>
          ) : flags.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Flag className="h-5 w-5" />}
                title="No feature flags"
                description="No flags are defined in the environment or referenced by an application manifest."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {flags.map((flag) => (
                <li key={flag.key} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="font-mono text-[12.5px] text-foreground">{flag.key}</div>
                    <div className="text-[12px] text-muted-foreground">
                      {flag.enabled ? "Enabled" : "Disabled"}
                    </div>
                  </div>
                  <Switch
                    checked={flag.enabled}
                    disabled={pending.has(flag.key)}
                    onCheckedChange={(checked) => setConfirming({ key: flag.key, next: checked })}
                    aria-label={`${flag.enabled ? "Disable" : "Enable"} ${flag.key}`}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </PageBody>

      <AlertDialog open={!!confirming} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming?.next ? "Enable" : "Disable"} “{confirming?.key}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Changing a feature flag can enable or hide functionality for every user immediately. This
              override is applied at runtime and reverts to the environment default on restart.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirming) mutation.mutate({ key: confirming.key, enabled: confirming.next });
                setConfirming(null);
              }}
            >
              {confirming?.next ? "Enable" : "Disable"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
