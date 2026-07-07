import { createFileRoute } from "@tanstack/react-router";
import { BusinessPageRoute } from "@/applications/business/routes/business.$page";

export const Route = createFileRoute("/business/$page")({ component: RouteComponent });

function RouteComponent() {
  const { page } = Route.useParams();
  return <BusinessPageRoute page={page} />;
}
