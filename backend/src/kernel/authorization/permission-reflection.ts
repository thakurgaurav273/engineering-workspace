import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY, PermissionRequirement } from './require-permission.decorator';

/** Reads the permission requirement from the handler (falling back to the class). */
export function getPermissionRequirement(
  reflector: Reflector,
  context: ExecutionContext,
): PermissionRequirement | undefined {
  return reflector.getAllAndOverride<PermissionRequirement>(PERMISSION_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
}
