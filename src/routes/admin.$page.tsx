import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/components/admin/admin-page";

export const Route = createFileRoute("/admin/$page")({
  component: AdminRouteComponent,
});

function AdminRouteComponent() {
  const { page } = Route.useParams();
  return <AdminPage pageKey={page} />;
}
