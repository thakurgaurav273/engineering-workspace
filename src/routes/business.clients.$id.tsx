import { createFileRoute } from "@tanstack/react-router";
import { ClientDetailPage } from "@/applications/business/routes/business.clients.$id";

export const Route = createFileRoute("/business/clients/$id")({ component: RouteComponent });

function RouteComponent() {
  const { id } = Route.useParams();
  return <ClientDetailPage id={id} />;
}
