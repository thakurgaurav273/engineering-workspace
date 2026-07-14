import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayload {
  sub: string;
  email: string;
  /** The org this request is scoped to. May be an acting-as tenant for a super-admin (see below). */
  orgId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  /**
   * Set only when a platform super-admin is acting on another tenant via the `X-Org-Id`
   * header. `orgId` is then the target org and `homeOrgId` the operator's real org.
   */
  actingAsOrgId?: string;
  homeOrgId?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtPayload;
  },
);
