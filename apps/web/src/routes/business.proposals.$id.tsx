import { createFileRoute } from "@tanstack/react-router";
import { ProposalDetailPage } from "@/applications/business/routes/business.proposals.$id";

export const Route = createFileRoute("/business/proposals/$id")({ component: RouteComponent });

function RouteComponent() {
  const { id } = Route.useParams();
  return <ProposalDetailPage id={id} />;
}
