import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Link2, Package } from "lucide-react";
import { PageHeader, PageBody, Card, CardHeader, Badge, EmptyState, Skeleton, Button } from "@grovyn/ui/primitives";
import { toast } from "sonner";
import { api } from "@/shared/lib/api";

// Organization administration. The API currently scopes to the caller's own organization
// (GET/PATCH /organizations/me); a cross-org directory arrives with the multi-org backend.
// Mirrors the real endpoints only — no invented cross-tenant listing.

interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  description?: string | null;
  createdAt: string;
  updatedAt?: string;
  linearWorkspaceName?: string | null;
  linearConnectedAt?: string | null;
}

interface Installation {
  orgId: string;
  applicationKey: string;
  state: "INSTALLED" | "DISABLED" | "MAINTENANCE" | "UNINSTALLED";
  config?: unknown;
}

const STATE_TONE: Record<string, "neutral" | "info" | "success" | "warning"> = {
  INSTALLED: "success",
  DISABLED: "neutral",
  MAINTENANCE: "warning",
  UNINSTALLED: "neutral",
};

export function OrganizationsAdmin() {
  const queryClient = useQueryClient();

  const orgQuery = useQuery<Organization>({
    queryKey: ["organizations", "me"],
    queryFn: () => api.get("/organizations/me"),
  });

  const org = orgQuery.data;

  const installationsQuery = useQuery<Installation[]>({
    queryKey: ["organizations", "installations", org?.id],
    queryFn: () => api.get(`/organizations/${org!.id}/installations`),
    enabled: !!org?.id,
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Seed the form once the org loads (and whenever it changes on the server).
  useEffect(() => {
    if (org) {
      setName(org.name ?? "");
      setDescription(org.description ?? "");
    }
  }, [org]);

  const mutation = useMutation({
    mutationFn: (body: { name?: string; description?: string }) => api.patch("/organizations/me", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", "me"] });
      toast.success("Organization updated");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't update the organization (owner access required)"),
  });

  const dirty = useMemo(
    () => !!org && (name.trim() !== (org.name ?? "") || description.trim() !== (org.description ?? "")),
    [org, name, description],
  );

  const installs = installationsQuery.data ?? [];

  return (
    <>
      <PageHeader title="Organizations" description="Manage the current organization." />
      <PageBody className="space-y-6">
        <p className="text-[12.5px] text-muted-foreground">
          The platform API currently scopes to your organization. A cross-organization directory becomes
          available when the multi-org backend lands.
        </p>

        {orgQuery.isLoading ? (
          <Card className="p-6 space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </Card>
        ) : orgQuery.isError || !org ? (
          <Card className="p-6">
            <EmptyState
              icon={<Building2 className="h-5 w-5" />}
              title="Couldn't load your organization"
              description="The organization endpoint returned an error. Try again shortly."
            />
          </Card>
        ) : (
          <>
            <Card className="p-0 overflow-hidden">
              <CardHeader title="Details" subtitle={`@${org.slug}`} />
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-accent text-muted-foreground">
                    {org.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={org.logoUrl} alt={org.name} className="h-full w-full object-cover" />
                    ) : (
                      <Building2 className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-foreground">{org.name}</div>
                    <div className="text-[12px] text-muted-foreground">
                      Created {new Date(org.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="ml-auto">
                    <Badge tone={org.linearConnectedAt ? "success" : "neutral"}>
                      <Link2 className="h-3 w-3" />
                      {org.linearConnectedAt ? `Linear: ${org.linearWorkspaceName ?? "connected"}` : "Linear not connected"}
                    </Badge>
                  </div>
                </div>

                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (dirty) mutation.mutate({ name: name.trim(), description: description.trim() });
                  }}
                >
                  <div>
                    <label htmlFor="org-name" className="mb-1 block text-[12px] font-medium text-muted-foreground">
                      Name
                    </label>
                    <input
                      id="org-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label htmlFor="org-desc" className="mb-1 block text-[12px] font-medium text-muted-foreground">
                      Description
                    </label>
                    <textarea
                      id="org-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="submit" disabled={!dirty || mutation.isPending}>
                      {mutation.isPending ? "Saving…" : "Save changes"}
                    </Button>
                    {dirty && !mutation.isPending && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setName(org.name ?? "");
                          setDescription(org.description ?? "");
                        }}
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                </form>
              </div>
            </Card>

            <Card className="p-0 overflow-hidden">
              <CardHeader title="Installed applications" subtitle="Applications this organization has installed." />
              {installationsQuery.isLoading ? (
                <div className="p-5 space-y-2">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-2/3" />
                </div>
              ) : installs.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={<Package className="h-5 w-5" />}
                    title="No installation records"
                    description="This organization has no explicit application installation state (defaults apply)."
                  />
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {installs.map((i) => (
                    <li key={i.applicationKey} className="flex items-center justify-between gap-3 px-5 py-3">
                      <span className="text-[13px] font-medium text-foreground">{i.applicationKey}</span>
                      <Badge tone={STATE_TONE[i.state] ?? "neutral"}>{i.state}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </PageBody>
    </>
  );
}
