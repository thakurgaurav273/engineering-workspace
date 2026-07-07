import { createFileRoute } from "@tanstack/react-router";
import { BusinessOperationsPage } from "@/components/business-operations/business-operations-page";

export const Route = createFileRoute("/business/$page")({
  component: BusinessRouteComponent,
});

function BusinessRouteComponent() {
  const { page } = Route.useParams();
  return <BusinessOperationsPage pageKey={page} />;
}
