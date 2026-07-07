import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/applications/business/routes/business.dashboard";

export const Route = createFileRoute("/business/dashboard")({ component: DashboardPage });
