import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/platform/shell/app-shell";
import { PageHeader, PageBody } from "@/shared/components/primitives";
import { flags } from "@/shared/lib/flags";
import { getStoredAuth } from "@/platform/auth/auth";
import { useApplication } from "@/platform/registry/application-context";
import { InvoiceEditor } from "@/applications/business/components/invoice-editor";


export function NewInvoicePage() {
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
