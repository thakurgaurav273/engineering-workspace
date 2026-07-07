import { createFileRoute } from "@tanstack/react-router";
import { NewQuotationPage } from "@/applications/business/routes/business.quotations.new";

export const Route = createFileRoute("/business/quotations/new")({ component: NewQuotationPage });
