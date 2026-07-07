import { createFileRoute } from "@tanstack/react-router";
import { InvoicesPage } from "@/applications/business/routes/business.invoices";

export const Route = createFileRoute("/business/invoices")({ component: InvoicesPage });
