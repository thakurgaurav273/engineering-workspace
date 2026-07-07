import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader, PageBody } from "@/components/primitives";
import { flags } from "@/lib/flags";
import { getStoredAuth } from "@/lib/auth";
import { useApplication } from "@/lib/application-context";
import { InvoiceEditor } from "@/components/business/invoice-editor";

export const Route = createFileRoute("/business/invoices/new")({
  component: NewInvoicePage,
});

function NewInvoicePage() {
  const navigate = useNavigate();
  const { applications, isLoading } = useApplication();
  const available = applications.some((a) => a.key === "business-operations");
  const role = getStoredAuth()?.user?.role;
  const canEdit = role === "OWNER" || role === "ADMIN";

  useEffect(() => {
    if (!flags.platformShell) navigate({ to: "/", replace: true });
    else if (!isLoading && !available) navigate({ to: "/", replace: true });
    else if (!isLoading && available && !canEdit)
      navigate({ to: "/business/invoices", replace: true });
  }, [isLoading, available, canEdit, navigate]);

  if (!flags.platformShell || isLoading || !available || !canEdit) return null;

  return (
    <AppShell>
      <PageHeader title="New invoice" description="Business Operations" />
      <PageBody>
        <InvoiceEditor />
      </PageBody>
    </AppShell>
  );
}
