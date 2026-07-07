import { createFileRoute } from "@tanstack/react-router";
import { NewInvoicePage } from "@/applications/business/routes/business.invoices.new";

export const Route = createFileRoute("/business/invoices/new")({ component: NewInvoicePage });
