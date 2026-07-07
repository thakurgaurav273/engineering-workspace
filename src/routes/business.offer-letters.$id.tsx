import { createFileRoute } from "@tanstack/react-router";
import { OfferLetterDetailPage } from "@/applications/business/routes/business.offer-letters.$id";

export const Route = createFileRoute("/business/offer-letters/$id")({ component: RouteComponent });

function RouteComponent() {
  const { id } = Route.useParams();
  return <OfferLetterDetailPage id={id} />;
}
