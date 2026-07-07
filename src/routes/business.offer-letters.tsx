import { createFileRoute } from "@tanstack/react-router";
import { OfferLettersPage } from "@/applications/business/routes/business.offer-letters";

export const Route = createFileRoute("/business/offer-letters")({ component: OfferLettersPage });
