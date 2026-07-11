import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '@/prisma/prisma.service';
import { PlatformRoleService } from '@/kernel/platform-role/platform-role.service';

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
    });
  }

  // The access token's `orgId` names which org this request is scoped to. Membership is
  // the source of truth for org access - re-checked fresh on every request (not trusted
  // from the token) so a role change or removal takes effect immediately, same guarantee
  // the old single-org lookup gave. A SUSPENDED tenant blocks all its users the same way,
  // except platform SUPER_ADMINs (so an operator can still reach the admin app to unsuspend).
  async validate(payload: { sub: string; email: string; orgId: string }) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId: payload.sub, orgId: payload.orgId } },
      select: { role: true, status: true, org: { select: { status: true } } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new UnauthorizedException('No active access to this organization');
    }
    if (membership.org.status === 'SUSPENDED' && !this.platformRole.isSuperAdmin(payload.email)) {
      throw new UnauthorizedException('This organization is suspended');
    }
    return { sub: payload.sub, email: payload.email, orgId: payload.orgId, role: membership.role };
  }
}
