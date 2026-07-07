import { BusinessOperationsPage } from "@/applications/business/components/business-operations-page";

export function BusinessPageRoute({ page }: { page: string }) {
  return <BusinessOperationsPage pageKey={page} />;
}
