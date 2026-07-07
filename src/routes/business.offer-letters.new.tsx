import { createFileRoute } from "@tanstack/react-router";
import { NewOfferLetterPage } from "@/applications/business/routes/business.offer-letters.new";

export const Route = createFileRoute("/business/offer-letters/new")({ component: NewOfferLetterPage });
