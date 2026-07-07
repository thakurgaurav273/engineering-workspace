import { createFileRoute } from "@tanstack/react-router";
import { InvoiceDetailPage } from "@/applications/business/routes/business.invoices.$id";

export const Route = createFileRoute("/business/invoices/$id")({ component: RouteComponent });

function RouteComponent() {
  const { id } = Route.useParams();
  return <InvoiceDetailPage id={id} />;
}
