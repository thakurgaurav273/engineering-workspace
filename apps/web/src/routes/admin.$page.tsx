import { createFileRoute } from "@tanstack/react-router";
import { AdminPageRoute } from "@/applications/platform/routes/admin.$page";

export const Route = createFileRoute("/admin/$page")({ component: RouteComponent });

function RouteComponent() {
  const { page } = Route.useParams();
  return <AdminPageRoute page={page} />;
}
