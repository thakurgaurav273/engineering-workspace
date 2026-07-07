import { createFileRoute } from "@tanstack/react-router";
import { ApplicationMetadata } from "@/components/apps/application-metadata";

export const Route = createFileRoute("/apps/$key")({
  component: ApplicationMetadataRoute,
});

function ApplicationMetadataRoute() {
  const { key } = Route.useParams();
  return <ApplicationMetadata appKey={key} />;
}
