import { BusinessOperationsPage } from "@/applications/business/components/business-operations-page";

// `/business` (the app root, i.e. the launcher target) shows the dashboard.
export function BusinessIndexRoute() {
  return <BusinessOperationsPage pageKey="dashboard" />;
}
