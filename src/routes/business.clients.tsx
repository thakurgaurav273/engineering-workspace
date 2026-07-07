import { createFileRoute } from "@tanstack/react-router";
import { ClientsPage } from "@/applications/business/routes/business.clients";

export const Route = createFileRoute("/business/clients")({ component: ClientsPage });
