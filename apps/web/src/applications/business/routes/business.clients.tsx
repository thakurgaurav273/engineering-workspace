import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { Plus, Search, Pencil, Archive, RotateCcw, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/platform/shell/app-shell";
import { PageHeader, PageBody, Card, Button } from "@/shared/components/primitives";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { flags } from "@/shared/lib/flags";
import { getStoredAuth } from "@/platform/auth/auth";
import { useApplication } from "@/platform/registry/application-context";
import { useClients, useClientMutations, type Client } from "@/applications/business/lib/business-clients";
import { ClientFormDialog } from "@/applications/business/components/client-form-dialog";


export function ClientsPage() {
  const navigate = useNavigate();
  const { applications, isLoading: appsLoading } = useApplication();
  const available = applications.some((a) => a.key === "business-operations");
  const role = getStoredAuth()?.user?.role;
  const canEdit = role === "OWNER" || role === "ADMIN";

  useEffect(() => {
    if (!flags.platformShell) navigate({ to: "/", replace: true });
    else if (!appsLoading && !available) navigate({ to: "/", replace: true });
  }, [appsLoading, available, navigate]);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [archived, setArchived] = useState(false);
  const [type, setType] = useState<"" | "COMPANY" | "INDIVIDUAL">("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Client | undefined>();
  const [confirmArchive, setConfirmArchive] = useState<Client | undefined>();

  const { archive, restore } = useClientMutations();
  const { data, isLoading, isError, isFetching } = useClients(
    { page, limit: 20, search, type, archived, sort: "createdAt", order: "desc" },
    flags.platformShell && available,
  );

  if (!flags.platformShell || appsLoading || !available) return null;

  const clients = data?.data ?? [];

  return (
    <AppShell>
      <PageHeader
        title="Clients"
        description="Business Operations"
        actions={
          canEdit ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New client
            </Button>
          ) : undefined
        }
      />
      <PageBody>
        {/* Toolbar */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search clients…"
              className="w-full rounded-md border border-border bg-surface py-2 pl-8 pr-3 text-[13px] outline-none focus:border-ring"
            />
          </div>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as typeof type);
              setPage(1);
            }}
            className="rounded-md border border-border bg-surface px-2.5 py-2 text-[13px]"
          >
            <option value="">All types</option>
            <option value="COMPANY">Company</option>
            <option value="INDIVIDUAL">Individual</option>
          </select>
          <label className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-2 text-[13px]">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => {
                setArchived(e.target.checked);
                setPage(1);
              }}
            />
            Archived
          </label>
        </div>

        <Card className="p-0 overflow-hidden">
          {isLoading ? (
            <div className="grid place-items-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : isError ? (
            <div className="py-12 text-center text-[13px] text-muted-foreground">
              Couldn't load clients. Please try again.
            </div>
          ) : clients.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[14px] font-medium">No clients {archived ? "archived" : "yet"}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {archived ? "Nothing archived." : "Add your first client to get started."}
              </p>
              {canEdit && !archived ? (
                <Button className="mt-4" onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" /> New client
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Type</th>
                    <th className="px-4 py-2.5 font-medium">Contact</th>
                    <th className="px-4 py-2.5 font-medium">GSTIN</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-border last:border-0 hover:bg-accent/40"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          to="/business/clients/$id"
                          params={{ id: c.id }}
                          className="font-medium hover:underline"
                        >
                          {c.name}
                        </Link>
                        {c.companyName && c.companyName !== c.name ? (
                          <div className="text-[11.5px] text-muted-foreground">{c.companyName}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {c.type === "COMPANY" ? "Company" : "Individual"}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        <div>{c.email ?? "—"}</div>
                        {c.phone ? <div className="text-[11.5px]">{c.phone}</div> : null}
                      </td>
                      <td className="px-4 py-2.5 font-mono-num text-muted-foreground">
                        {c.gstin ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusPill client={c} />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton
                            title="View"
                            onClick={() =>
                              navigate({ to: "/business/clients/$id", params: { id: c.id } })
                            }
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </IconButton>
                          {canEdit && !c.archivedAt ? (
                            <IconButton title="Edit" onClick={() => setEditing(c)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </IconButton>
                          ) : null}
                          {canEdit && !c.archivedAt ? (
                            <IconButton title="Archive" onClick={() => setConfirmArchive(c)}>
                              <Archive className="h-3.5 w-3.5" />
                            </IconButton>
                          ) : null}
                          {canEdit && c.archivedAt ? (
                            <IconButton
                              title="Restore"
                              onClick={() =>
                                restore.mutate(c.id, {
                                  onSuccess: () => toast.success("Client restored"),
                                  onError: () => toast.error("Couldn't restore client"),
                                })
                              }
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </IconButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Pagination */}
        {data && data.totalPages > 1 ? (
          <div className="mt-3 flex items-center justify-between text-[12.5px] text-muted-foreground">
            <span>
              {data.total} client{data.total === 1 ? "" : "s"}
              {isFetching ? " · updating…" : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span>
                Page {data.page} of {data.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </PageBody>

      {/* Dialogs */}
      <ClientFormDialog open={creating} onOpenChange={setCreating} />
      <ClientFormDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(undefined)}
        client={editing}
      />

      <Dialog open={!!confirmArchive} onOpenChange={(v) => !v && setConfirmArchive(undefined)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archive client?</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-muted-foreground">
            "{confirmArchive?.name}" will be archived (soft delete). You can restore it later.
            Related documents are never deleted.
          </p>
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => setConfirmArchive(undefined)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={archive.isPending}
              onClick={() => {
                const c = confirmArchive!;
                archive.mutate(c.id, {
                  onSuccess: () => {
                    toast.success("Client archived");
                    setConfirmArchive(undefined);
                  },
                  onError: () => toast.error("Couldn't archive client"),
                });
              }}
            >
              {archive.isPending ? "Archiving…" : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function StatusPill({ client }: { client: Client }) {
  const label = client.archivedAt ? "Archived" : client.isActive ? "Active" : "Inactive";
  const cls = client.archivedAt
    ? "bg-muted text-muted-foreground"
    : client.isActive
      ? "bg-accent text-foreground"
      : "border border-border text-muted-foreground";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>;
}

function IconButton({
  children,
  title,
  onClick,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}
