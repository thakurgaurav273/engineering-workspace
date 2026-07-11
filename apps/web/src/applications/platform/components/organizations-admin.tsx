import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Link2 } from "lucide-react";
import { PageHeader, PageBody, Card, CardHeader, Badge, EmptyState, Skeleton, Button } from "@grovyn/ui/primitives";
import { toast } from "sonner";
import { api } from "@/shared/lib/api";
import { OrgDetailDialog } from "@/applications/platform/components/org-detail-dialog";

// Organization directory (SUPER_ADMIN). Lists every organization from GET /platform/organizations,
// and lets the caller edit their own organization via GET/PATCH /organizations/me. An organization
// is the platform's tenant - the top-level account and isolation boundary.

interface OrgDirectoryRow {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED";
  description: string | null;
  logoUrl: string | null;
  createdAt: string;
  linearWorkspaceName: string | null;
  memberCount: number;
  userCount: number;
  appCount: number;
}

interface CurrentOrg {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

export function OrganizationsAdmin() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const dirQuery = useQuery<OrgDirectoryRow[]>({
    queryKey: ["platform", "organizations"],
    queryFn: () => api.get("/platform/organizations"),
  });

  const meQuery = useQuery<CurrentOrg>({
    queryKey: ["organizations", "me"],
    queryFn: () => api.get("/organizations/me"),
  });
  const me = meQuery.data;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  useEffect(() => {
    if (me) {
      setName(me.name ?? "");
      setDescription(me.description ?? "");
    }
  }, [me]);

  const mutation = useMutation({
    mutationFn: (body: { name?: string; description?: string }) => api.patch("/organizations/me", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", "me"] });
      queryClient.invalidateQueries({ queryKey: ["platform", "organizations"] });
      toast.success("Organization updated");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't update the organization (owner access required)"),
  });

  const orgs = dirQuery.data ?? [];
  const dirty = !!me && (name.trim() !== (me.name ?? "") || description.trim() !== (me.description ?? ""));

  return (
    <>
      <PageHeader title="Organizations" description="Every organization on the platform. An organization is a tenant - the top-level account." />
      <PageBody className="space-y-6">
        {/* Current organization (editable) */}
        <Card className="p-0 overflow-hidden">
          <CardHeader title="Your organization" subtitle={me ? `@${me.slug}` : undefined} />
          {meQuery.isLoading || !me ? (
            <div className="p-5 space-y-3">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <form
              className="p-5 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (dirty) mutation.mutate({ name: name.trim(), description: description.trim() });
              }}
            >
              <div>
                <label htmlFor="org-name" className="mb-1 block text-[12px] font-medium text-muted-foreground">Name</label>
                <input
                  id="org-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </div>
              <div>
                <label htmlFor="org-desc" className="mb-1 block text-[12px] font-medium text-muted-foreground">Description</label>
                <textarea
                  id="org-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </div>
              <Button type="submit" disabled={!dirty || mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </form>
          )}
        </Card>

        {/* All organizations (directory) */}
        <Card className="p-0 overflow-hidden">
          <CardHeader title="All organizations" subtitle={`${orgs.length} organization${orgs.length === 1 ? "" : "s"} on the platform.`} />
          {dirQuery.isLoading ? (
            <div className="p-5 space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-2/3" />
            </div>
          ) : dirQuery.isError ? (
            <div className="p-6">
              <EmptyState icon={<Building2 className="h-5 w-5" />} title="Couldn't load organizations" description="The directory endpoint returned an error. Confirm platform super-admin access." />
            </div>
          ) : orgs.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={<Building2 className="h-5 w-5" />} title="No organizations" description="No organizations exist on the platform yet." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[13px]">
                <thead className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-2 font-medium">Organization</th>
                    <th className="px-5 py-2 font-medium text-right">Members</th>
                    <th className="px-5 py-2 font-medium text-right">Apps</th>
                    <th className="px-5 py-2 font-medium">Status</th>
                    <th className="px-5 py-2 font-medium">Linear</th>
                    <th className="px-5 py-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orgs.map((o) => (
                    <tr
                      key={o.id}
                      onClick={() => setSelected(o.id)}
                      className={`cursor-pointer transition-colors hover:bg-accent/40 ${o.id === me?.id ? "bg-accent/30" : ""}`}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-accent text-muted-foreground">
                            {o.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={o.logoUrl} alt={o.name} className="h-full w-full object-cover" />
                            ) : (
                              <Building2 className="h-4 w-4" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 font-medium text-foreground">
                              {o.name}
                              {o.id === me?.id && <Badge tone="info">You</Badge>}
                            </div>
                            <div className="text-[12px] text-muted-foreground">@{o.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{o.memberCount}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{o.appCount}</td>
                      <td className="px-5 py-3">
                        <Badge tone={o.status === "SUSPENDED" ? "warning" : "success"}>
                          {o.status === "SUSPENDED" ? "Suspended" : "Active"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        {o.linearWorkspaceName ? (
                          <Badge tone="success"><Link2 className="h-3 w-3" />{o.linearWorkspaceName}</Badge>
                        ) : (
                          <span className="text-[12px] text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{new Date(o.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </PageBody>
      <OrgDetailDialog orgId={selected} onClose={() => setSelected(null)} />
    </>
  );
}
