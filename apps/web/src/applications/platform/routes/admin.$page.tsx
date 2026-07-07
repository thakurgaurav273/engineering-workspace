import { AdminPage } from "@/applications/platform/components/admin-page";

export function AdminPageRoute({ page }: { page: string }) {
  return <AdminPage pageKey={page} />;
}
