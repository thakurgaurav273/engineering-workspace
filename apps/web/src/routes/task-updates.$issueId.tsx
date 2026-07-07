import { createFileRoute } from "@tanstack/react-router";
import { IssueDetailPage } from "@/applications/engineering/routes/task-updates.$issueId";

export const Route = createFileRoute("/task-updates/$issueId")({ component: RouteComponent });

function RouteComponent() {
  const { issueId } = Route.useParams();
  return <IssueDetailPage issueId={issueId} />;
}
