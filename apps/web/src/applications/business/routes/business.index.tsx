import { DashboardPage } from "@/applications/business/routes/business.dashboard";

// `/business` (the app root, i.e. the launcher target) IS the Business Operations dashboard -
// the same page as `/business/dashboard`, not a placeholder.
export function BusinessIndexRoute() {
  return <DashboardPage />;
}
