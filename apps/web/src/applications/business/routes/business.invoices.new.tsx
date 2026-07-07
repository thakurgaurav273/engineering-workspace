import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/platform/shell/app-shell";
import { PageHeader, PageBody } from "@grovyn/ui/primitives";
import { flags } from "@/shared/lib/flags";
import { getStoredAuth } from "@/platform/auth/auth";
import { useApplication } from "@/platform/registry/application-context";
import { InvoiceEditor } from "@/applications/business/components/invoice-editor";


export function NewInvoicePage() {
  const navigate = useRouter();
  const { applications, isLoading } = useApplication();
  const available = applications.some((a) => a.key === "business-operations");
  const role = getStoredAuth()?.user?.role;
  const canEdit = role === "OWNER" || role === "ADMIN";

  useEffect(() => {
    if (!flags.platformShell) navigate.replace("/");
    else if (!isLoading && !available) navigate.replace("/");
    else if (!isLoading && available && !canEdit)
      navigate.replace("/business/invoices");
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
