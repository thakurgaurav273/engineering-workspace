import { Injectable, Logger } from '@nestjs/common';
import { FeatureFlagService } from '../flags/feature-flag.service';
import { RequestContextService } from '../context/request-context.service';
import { Pdp, AuthzPrincipal } from './pdp.service';
import { PermissionResolver } from './permission-resolver.service';
import { PermissionRequirement } from './require-permission.decorator';

export interface ShadowContext {
  principal: AuthzPrincipal;
  route: string;
  handler: string;
  requiredRoles: string[];
  guardAllow: boolean;
}

/**
 * Runs the PDP alongside the authoritative RolesGuard and logs divergence. Two comparisons:
 * the role parity check (sync) and, when an endpoint declares @RequirePermission, the
 * permission decision (async, DB-backed). Gated by the `authz.shadow` flag. NEVER changes
 * the decision — the guard's result is always returned.
 */
@Injectable()
export class ShadowAuthService {
  private readonly logger = new Logger('ShadowAuth');

  constructor(
    private readonly pdp: Pdp,
    private readonly resolver: PermissionResolver,
    private readonly flags: FeatureFlagService,
    private readonly context: RequestContextService,
  ) {}

  evaluate(ctx: ShadowContext): void {
    if (!this.flags.isEnabled('authz.shadow')) return;
    const decision = this.pdp.checkRoles(ctx.principal, ctx.requiredRoles);
    if (decision.allow === ctx.guardAllow) return;
    this.logger.warn(
      JSON.stringify({
        event: 'authz.shadow.role-divergence',
        correlationId: this.context.correlationId,
        user: ctx.principal?.sub,
        email: ctx.principal?.email,
        role: ctx.principal?.role,
        application: applicationFromRoute(ctx.route),
        route: ctx.route,
        handler: ctx.handler,
        requiredRoles: ctx.requiredRoles,
        guardAllow: ctx.guardAllow,
        pdpAllow: decision.allow,
        reason: decision.reason,
      }),
    );
  }

  /** Fire-and-forget permission comparison. Async (DB); errors are caught, never thrown. */
  async evaluatePermission(ctx: ShadowContext & { requirement?: PermissionRequirement }): Promise<void> {
    if (!this.flags.isEnabled('authz.shadow')) return;
    if (!ctx.requirement || ctx.requirement.permissions.length === 0) return;
    const correlationId = this.context.correlationId;
    try {
      const decision = await this.resolver.resolve(ctx.principal, ctx.requirement);
      if (decision.allow === ctx.guardAllow) return;
      this.logger.warn(
        JSON.stringify({
          event: 'authz.shadow.permission-divergence',
          correlationId,
          user: ctx.principal?.sub,
          email: ctx.principal?.email,
          role: ctx.principal?.role,
          application: applicationFromRoute(ctx.route),
          route: ctx.route,
          handler: ctx.handler,
          requiredRoles: ctx.requiredRoles,
          permissions: ctx.requirement.permissions,
          guardAllow: ctx.guardAllow,
          pdpAllow: decision.allow,
          reason: decision.reason,
        }),
      );
    } catch (error) {
      this.logger.error(
        `shadow permission eval failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

function applicationFromRoute(route: string): string {
  const segment = route.split('?')[0].split('/').filter(Boolean)[0];
  return segment ?? 'unknown';
}
