import { createFileRoute } from "@tanstack/react-router";
import { PaymentsPage } from "@/applications/business/routes/business.payments";

export const Route = createFileRoute("/business/payments")({ component: PaymentsPage });
