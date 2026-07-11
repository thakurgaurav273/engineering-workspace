import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionResolver } from './permission-resolver.service';
import { getPermissionRequirement } from './permission-reflection';

/**
 * Enforcement guard for permission-based authorization. INFRASTRUCTURE ONLY - it is NOT
 * registered anywhere in this milestone (the RolesGuard remains authoritative and the PDP
 * stays in shadow mode). It exists so a future cut-over is a wiring change, not new code.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resolver: PermissionResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = getPermissionRequirement(this.reflector, context);
    if (!requirement) return true;
    const user = context.switchToHttp().getRequest()?.user;
    const decision = await this.resolver.resolve(user ?? {}, requirement);
    return decision.allow;
  }
}
