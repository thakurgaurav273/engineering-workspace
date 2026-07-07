import { createFileRoute } from "@tanstack/react-router";
import { BusinessOperationsPage } from "@/components/business-operations/business-operations-page";

// `/business` (the app root, i.e. the launcher target) shows the dashboard.
export const Route = createFileRoute("/business/")({
  component: () => <BusinessOperationsPage pageKey="dashboard" />,
});
