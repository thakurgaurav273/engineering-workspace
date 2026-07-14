import { PageHeader, PageBody } from "@grovyn/ui/primitives";
import { AppAccessMatrix } from "@/shared/components/app-access-matrix";
import { useAdminTenant, TenantSelector } from "@/applications/platform/components/admin-tenant";

// Platform Administration surface for per-user application access. A super-admin manages any org,
// switching tenants via the selector. The matrix itself is the shared AppAccessMatrix - the exact
// same implementation Organization Settings renders for OWNER/ADMIN of their own org.

export function AppAccessAdmin() {
  const { selectedOrgId } = useAdminTenant();
  return (
    <>
      <PageHeader
        title="App Access"
        description="Grant or revoke each application per user. Members see an app only when it is granted. Platform super-admins always see every application."
        actions={<TenantSelector />}
      />
      <PageBody>
        <AppAccessMatrix orgId={selectedOrgId} />
      </PageBody>
    </>
  );
}
