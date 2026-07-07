import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Archive, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PageBody, Card, Button } from "@/components/primitives";
import { flags } from "@/lib/flags";
import { getStoredAuth } from "@/lib/auth";
import { useApplication } from "@/lib/application-context";
import { useClient, useClientMutations } from "@/lib/business-clients";
import { ClientFormDialog } from "@/components/business/client-form-dialog";

export const Route = createFileRoute("/business/clients/$id")({
  component: ClientDetailPage,
});

function ClientDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { applications, isLoading: appsLoading } = useApplication();
  const available = applications.some((a) => a.key === "business-operations");
  const role = getStoredAuth()?.user?.role;
  const canEdit = role === "OWNER" || role === "ADMIN";
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!flags.platformShell) navigate({ to: "/", replace: true });
    else if (!appsLoading && !available) navigate({ to: "/", replace: true });
  }, [appsLoading, available, navigate]);

  const {
    data: client,
    isLoading,
    isError,
  } = useClient(flags.platformShell && available ? id : undefined);
  const { archive, restore } = useClientMutations();

  if (!flags.platformShell || appsLoading || !available) return null;

  return (
    <AppShell>
      <PageBody>
        <Link
          to="/business/clients"
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Clients
        </Link>

        {isLoading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : isError || !client ? (
          <Card className="p-6 text-[13px] text-muted-foreground">Client not found.</Card>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold tracking-tight">{client.name}</h1>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {client.type === "COMPANY" ? "Company" : "Individual"}
                  {client.archivedAt ? " · Archived" : client.isActive ? "" : " · Inactive"}
                </p>
              </div>
              {canEdit ? (
                <div className="flex items-center gap-2">
                  {!client.archivedAt ? (
                    <>
                      <Button variant="secondary" onClick={() => setEditing(true)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          archive.mutate(client.id, {
                            onSuccess: () => toast.success("Client archived"),
                            onError: () => toast.error("Couldn't archive client"),
                          })
                        }
                      >
                        <Archive className="h-3.5 w-3.5" /> Archive
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        restore.mutate(client.id, {
                          onSuccess: () => toast.success("Client restored"),
                          onError: () => toast.error("Couldn't restore client"),
                        })
                      }
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restore
                    </Button>
                  )}
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="p-4">
                <SectionTitle>Overview</SectionTitle>
                <Row label="Company name" value={client.companyName} />
                <Row label="Contact person" value={client.contactPersonName} />
                <Row label="Email" value={client.email} />
                <Row label="Phone" value={client.phone} />
                <Row label="Website" value={client.website} />
                <Row
                  label="Tags"
                  value={client.tags?.length ? client.tags.join(", ") : undefined}
                />
              </Card>

              <Card className="p-4">
                <SectionTitle>Tax</SectionTitle>
                <Row label="GSTIN" value={client.gstin} />
                <Row label="PAN" value={client.pan} />
                <Row label="Tax ID" value={client.taxId} />
              </Card>

              <Card className="p-4">
                <SectionTitle>Billing address</SectionTitle>
                <Address
                  parts={[
                    client.billingLine1,
                    client.billingLine2,
                    client.billingCity,
                    client.billingState,
                    client.billingPostalCode,
                    client.billingCountry,
                  ]}
                />
              </Card>

              <Card className="p-4">
                <SectionTitle>Shipping address</SectionTitle>
                <Address
                  parts={[
                    client.shippingLine1,
                    client.shippingLine2,
                    client.shippingCity,
                    client.shippingState,
                    client.shippingPostalCode,
                    client.shippingCountry,
                  ]}
                />
              </Card>

              {client.notes ? (
                <Card className="p-4 lg:col-span-2">
                  <SectionTitle>Notes</SectionTitle>
                  <p className="whitespace-pre-wrap text-[13px]">{client.notes}</p>
                </Card>
              ) : null}
            </div>

            <ClientFormDialog open={editing} onOpenChange={setEditing} client={client} />
          </>
        )}
      </PageBody>
    </AppShell>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-1.5 text-[13px] last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}

function Address({ parts }: { parts: (string | null | undefined)[] }) {
  const lines = parts.filter(Boolean);
  if (lines.length === 0) return <p className="text-[13px] text-muted-foreground">—</p>;
  return <p className="text-[13px]">{lines.join(", ")}</p>;
}
