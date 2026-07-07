import { Injectable } from '@nestjs/common';
import { Pdp, AuthzPrincipal, AuthzDecision } from './pdp.service';
import { PermissionRequirement } from './require-permission.decorator';

/** Resolves a {@link PermissionRequirement} for a principal via the PDP (any/all modes). */
@Injectable()
export class PermissionResolver {
  constructor(private readonly pdp: Pdp) {}

  async resolve(principal: AuthzPrincipal, requirement: PermissionRequirement): Promise<AuthzDecision> {
    const perms = requirement.permissions ?? [];
    if (perms.length === 0) return { allow: true, reason: 'no-permission-required' };

    const results = await Promise.all(perms.map((p) => this.pdp.checkPermission(principal, p)));
    if (requirement.mode === 'all') {
      const allow = results.every((r) => r.allow);
      return { allow, reason: allow ? `all:${perms.join(',')}` : `missing-some:${perms.join(',')}` };
    }
    const allow = results.some((r) => r.allow);
    return { allow, reason: allow ? `any:${perms.join(',')}` : `none:${perms.join(',')}` };
  }
}
