import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ShadowAuthService } from '../../kernel/authorization/shadow-auth.service';
import {
  PERMISSION_KEY,
  PermissionRequirement,
} from '../../kernel/authorization/require-permission.decorator';

export const ROLES_KEY = 'roles';

/**
 * Authoritative role-based guard. Unchanged behavior — still returns
 * `requiredRoles.includes(user.role)`. It additionally hands the decision to the PDP shadow
 * harness: a synchronous role-parity check and, when the endpoint declares
 * @RequirePermission, a fire-and-forget permission comparison. Neither can change the
 * returned result (both no-op unless the `authz.shadow` flag is on).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private shadow: ShadowAuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;

    const request = context.switchToHttp().getRequest();
    const user = request?.user;
    const allow = requiredRoles.includes(user?.role);

    const shadowCtx = {
      principal: user ?? {},
      route: `${request?.method ?? ''} ${request?.originalUrl ?? request?.url ?? ''}`.trim(),
      handler: context.getHandler()?.name ?? 'unknown',
      requiredRoles,
      guardAllow: allow,
    };

    // SHADOW MODE ONLY — never alters `allow`.
    this.shadow.evaluate(shadowCtx);

    const requirement = this.reflector.getAllAndOverride<PermissionRequirement>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requirement) {
      void this.shadow.evaluatePermission({ ...shadowCtx, requirement });
    }

    return allow;
  }
}
