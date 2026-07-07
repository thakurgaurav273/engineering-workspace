import { createFileRoute } from "@tanstack/react-router";
import { PersonPage } from "@/applications/engineering/routes/people.$id";

export const Route = createFileRoute("/people/$id")({ component: RouteComponent });

function RouteComponent() {
  const { id } = Route.useParams();
  return <PersonPage id={id} />;
}
