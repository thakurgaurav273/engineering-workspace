import { createFileRoute } from "@tanstack/react-router";
import { QuotationDetailPage } from "@/applications/business/routes/business.quotations.$id";

export const Route = createFileRoute("/business/quotations/$id")({ component: RouteComponent });

function RouteComponent() {
  const { id } = Route.useParams();
  return <QuotationDetailPage id={id} />;
}
