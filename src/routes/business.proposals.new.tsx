import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader, PageBody } from "@/components/primitives";
import { flags } from "@/lib/flags";
import { getStoredAuth } from "@/lib/auth";
import { useApplication } from "@/lib/application-context";
import { ProposalEditor } from "@/components/business/proposal-editor";

export const Route = createFileRoute("/business/proposals/new")({
  component: NewProposalPage,
});

function NewProposalPage() {
  const navigate = useNavigate();
  const { applications, isLoading } = useApplication();
  const available = applications.some((a) => a.key === "business-operations");
  const role = getStoredAuth()?.user?.role;
  const canEdit = role === "OWNER" || role === "ADMIN";

  useEffect(() => {
    if (!flags.platformShell) navigate({ to: "/", replace: true });
    else if (!isLoading && !available) navigate({ to: "/", replace: true });
    else if (!isLoading && available && !canEdit)
      navigate({ to: "/business/proposals", replace: true });
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
