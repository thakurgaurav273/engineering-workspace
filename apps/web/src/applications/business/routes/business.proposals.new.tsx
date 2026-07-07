import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/platform/shell/app-shell";
import { PageHeader, PageBody } from "@grovyn/ui/primitives";
import { flags } from "@/shared/lib/flags";
import { getStoredAuth } from "@/platform/auth/auth";
import { useApplication } from "@/platform/registry/application-context";
import { ProposalEditor } from "@/applications/business/components/proposal-editor";


export function NewProposalPage() {
  const navigate = useRouter();
  const { applications, isLoading } = useApplication();
  const available = applications.some((a) => a.key === "business-operations");
  const role = getStoredAuth()?.user?.role;
  const canEdit = role === "OWNER" || role === "ADMIN";

  useEffect(() => {
    if (!flags.platformShell) navigate.replace("/");
    else if (!isLoading && !available) navigate.replace("/");
    else if (!isLoading && available && !canEdit)
      navigate.replace("/business/proposals");
  }, [isLoading, available, canEdit, navigate]);

  if (!flags.platformShell || isLoading || !available || !canEdit) return null;

  return (
    <AppShell>
      <PageHeader title="New proposal" description="Business Operations" />
      <PageBody>
        <ProposalEditor />
      </PageBody>
    </AppShell>
  );
}
