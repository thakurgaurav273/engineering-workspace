import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'permission_requirement';

export interface PermissionRequirement {
  permissions: string[];
  /** 'any' (default) = the principal needs at least one; 'all' = every permission. */
  mode: 'any' | 'all';
}

/**
 * Declares the permission(s) an endpoint represents (`application:resource:action`).
 * Coexists with @Roles — during shadow mode the RolesGuard still decides the response and
 * the PDP only evaluates this observationally.
 */
export function RequirePermission(...permissions: string[]) {
  return SetMetadata(PERMISSION_KEY, { permissions, mode: 'any' } as PermissionRequirement);
}

/** As RequirePermission, but the principal must hold every listed permission. */
export function RequireAllPermissions(...permissions: string[]) {
  return SetMetadata(PERMISSION_KEY, { permissions, mode: 'all' } as PermissionRequirement);
}
