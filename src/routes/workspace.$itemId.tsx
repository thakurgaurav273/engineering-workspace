import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceItemDetailPage } from "@/applications/engineering/routes/workspace.$itemId";

export const Route = createFileRoute("/workspace/$itemId")({ component: RouteComponent });

function RouteComponent() {
  const { itemId } = Route.useParams();
  return <WorkspaceItemDetailPage itemId={itemId} />;
}
