import { createFileRoute } from "@tanstack/react-router";
import { QuotationsPage } from "@/applications/business/routes/business.quotations";

export const Route = createFileRoute("/business/quotations")({ component: QuotationsPage });
