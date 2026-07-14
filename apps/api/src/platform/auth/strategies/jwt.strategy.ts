import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '@/prisma/prisma.service';
import { PlatformRoleService } from '@/kernel/platform-role/platform-role.service';

/** Header a super-admin sends to operate org-scoped endpoints against another tenant. */
const ACTING_ORG_HEADER = 'x-org-id';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private prisma: PrismaService,
    private platformRole: PlatformRoleService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'fallback-secret',
      // We need the raw request to read the acting-as-org header (see validate).
      passReqToCallback: true,
    });
  }

  // The access token's `orgId` names which org this request is scoped to. Membership is
  // the source of truth for org access - re-checked fresh on every request (not trusted
  // from the token) so a role change or removal takes effect immediately, same guarantee
  // the old single-org lookup gave. A SUSPENDED tenant blocks all its users the same way,
  // except platform SUPER_ADMINs (so an operator can still reach the admin app to unsuspend).
  //
  // Cross-tenant override: the Platform Administration global tenant switcher sends an
  // `X-Org-Id` header. When a platform SUPER_ADMIN sends it, we rescope this request's
  // `orgId` to that tenant so every org-scoped endpoint (users, roles, app-access, …) acts
  // on the chosen org with no per-endpoint plumbing. The acting role is elevated to OWNER
  // because a super-admin holds no membership in the target org; non-super-admins may never
  // override (403). The shell's own identity queries never send the header, so the operator's
  // launcher/nav stay pinned to their home org - see the frontend api client's exclusions.
  async validate(req: Request, payload: { sub: string; email: string; orgId: string }) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId: payload.sub, orgId: payload.orgId } },
      select: { role: true, status: true, org: { select: { status: true } } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new UnauthorizedException('No active access to this organization');
    }
    const isSuperAdmin = this.platformRole.isSuperAdmin(payload.email);
    if (membership.org.status === 'SUSPENDED' && !isSuperAdmin) {
      throw new UnauthorizedException('This organization is suspended');
    }

    const base = {
      sub: payload.sub,
      email: payload.email,
      orgId: payload.orgId,
      role: membership.role,
    };

    const actingOrgId = this.readActingOrgId(req);
    if (!actingOrgId || actingOrgId === payload.orgId) return base;

    if (!isSuperAdmin) {
      throw new ForbiddenException('Cross-organization access requires a platform super admin');
    }
    const target = await this.prisma.organization.findUnique({
      where: { id: actingOrgId },
      select: { id: true },
    });
    if (!target) throw new ForbiddenException('Unknown organization');

    // homeOrgId preserves the operator's real org; actingAsOrgId marks the override for auditing.
    return {
      ...base,
      orgId: target.id,
      role: 'OWNER' as const,
      homeOrgId: payload.orgId,
      actingAsOrgId: target.id,
    };
  }

  private readActingOrgId(req: Request): string | undefined {
    const raw = req.headers[ACTING_ORG_HEADER];
    const value = Array.isArray(raw) ? raw[0] : raw;
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }
}
