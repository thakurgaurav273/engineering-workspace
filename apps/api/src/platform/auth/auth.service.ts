import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MembershipStatus, Role } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { PlatformRoleService } from '@/kernel/platform-role/platform-role.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}

export interface AuthResponseUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null | undefined;
  signatureUrl: string | null | undefined;
  orgId: string;
  jobTitle: string | null | undefined;
  department: string | null | undefined;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  createdAt: Date;
  organizations: OrgSummary[];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private platformRole: PlatformRoleService,
  ) {}

  async register(dto: RegisterDto) {
    const existingOrg = await this.prisma.organization.findUnique({
      where: { slug: dto.organizationSlug },
    });
    if (existingOrg) throw new ConflictException('Organization slug already taken');

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const result = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: dto.organizationName, slug: dto.organizationSlug },
      });

      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          // Legacy mirror fields - see the User model comment for why these still exist.
          orgId: org.id,
          jobTitle: 'Owner',
          role: 'OWNER',
          defaultOrganizationId: org.id,
          lastActiveOrganizationId: org.id,
        },
      });

      await tx.membership.create({
        data: {
          userId: user.id,
          orgId: org.id,
          role: 'OWNER',
          status: MembershipStatus.ACTIVE,
          jobTitle: 'Owner',
          joinedAt: new Date(),
          lastSeenAt: new Date(),
        },
      });

      await tx.userPreference.create({ data: { userId: user.id } });

      return { org, user };
    });

    const tokens = await this.generateTokens(
      result.user.id,
      result.user.email,
      result.org.id,
      'OWNER',
    );

    await this.logSwitch(result.user.id, null, result.org.id);

    this.logger.log(`New organization registered: ${result.org.slug}`);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: await this.buildAuthResponseUser(result.user.id, result.org.id),
    };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const memberships = await this.prisma.membership.findMany({
      where: { userId: user.id, status: MembershipStatus.ACTIVE },
      select: { orgId: true, role: true, createdAt: true },
    });
    if (!memberships.length) throw new UnauthorizedException('No active organization access');

    const orgId = this.pickActiveOrgId(user, memberships);
    const role = memberships.find((m) => m.orgId === orgId)!.role;

    // A suspended tenant blocks its users at sign-in (platform SUPER_ADMINs excepted, so an
    // operator can still reach the admin app to lift the suspension).
    if (!this.platformRole.isSuperAdmin(user.email)) {
      const org = await this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { status: true },
      });
      if (org?.status === 'SUSPENDED') {
        throw new UnauthorizedException('This organization is suspended');
      }
    }

    const tokens = await this.generateTokens(user.id, user.email, orgId, role);
    await this.syncLegacyUserFields(user.id, orgId);
    await this.touchMembership(user.id, orgId);
    await this.logSwitch(user.id, null, orgId, ipAddress, userAgent);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: await this.buildAuthResponseUser(user.id, orgId),
    };
  }

  async refresh(refreshToken: string) {
    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) await this.prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // The refresh token carries the previously active org as a non-binding hint (decoded,
    // not re-verified - DB possession of the exact token string already proves validity).
    // Session itself is user-scoped, not org-scoped: see the auth architecture notes.
    const decoded = this.jwt.decode(refreshToken) as { orgId?: string } | null;
    const orgId = await this.resolveOrgForRefresh(session.user.id, decoded?.orgId);

    await this.prisma.session.delete({ where: { id: session.id } });

    const membership = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId: session.user.id, orgId } },
      select: { role: true },
    });
    if (!membership) throw new UnauthorizedException('No active organization access');

    const tokens = await this.generateTokens(session.user.id, session.user.email, orgId, membership.role);
    await this.syncLegacyUserFields(session.user.id, orgId);

    return tokens;
  }

  async switchOrg(userId: string, targetOrgId: string, refreshToken: string, ipAddress?: string, userAgent?: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId: targetOrgId } },
      select: { role: true, status: true },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException("You don't have active access to that organization");
    }

    const session = await this.prisma.session.findUnique({ where: { refreshToken } });
    if (!session || session.userId !== userId) {
      throw new UnauthorizedException('Invalid session');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const fromOrgId = user.lastActiveOrganizationId ?? null;

    await this.prisma.session.delete({ where: { id: session.id } });
    const tokens = await this.generateTokens(userId, user.email, targetOrgId, membership.role);

    await this.syncLegacyUserFields(userId, targetOrgId);
    await this.touchMembership(userId, targetOrgId);
    await this.logSwitch(userId, fromOrgId, targetOrgId, ipAddress, userAgent);

    this.logger.log(`User ${userId} switched org ${fromOrgId ?? '(none)'} -> ${targetOrgId}`);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: await this.buildAuthResponseUser(userId, targetOrgId),
    };
  }

  async logout(userId: string, refreshToken: string) {
    await this.prisma.session.deleteMany({ where: { userId, refreshToken } });
    return { message: 'Logged out successfully' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    this.logger.log(`Password changed by ${userId}`);
    return { message: 'Password updated' };
  }

  async me(userId: string, orgId: string) {
    return this.buildAuthResponseUser(userId, orgId);
  }

  async issueTokensForUser(userId: string, orgId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
      select: { role: true },
    });
    if (!membership) throw new UnauthorizedException('No active organization access');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const tokens = await this.generateTokens(userId, user.email, orgId, membership.role);
    await this.syncLegacyUserFields(userId, orgId);
    await this.logSwitch(userId, null, orgId);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: await this.buildAuthResponseUser(userId, orgId),
    };
  }

  // Picks which org should be active on login/session-resume: explicit default, else
  // last-active, else the oldest membership - always constrained to orgs the account
  // still has ACTIVE access to.
  private pickActiveOrgId(
    user: { defaultOrganizationId: string | null; lastActiveOrganizationId: string | null },
    memberships: { orgId: string; createdAt: Date }[],
  ): string {
    const orgIds = new Set(memberships.map((m) => m.orgId));
    if (user.defaultOrganizationId && orgIds.has(user.defaultOrganizationId)) {
      return user.defaultOrganizationId;
    }
    if (user.lastActiveOrganizationId && orgIds.has(user.lastActiveOrganizationId)) {
      return user.lastActiveOrganizationId;
    }
    return [...memberships].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0].orgId;
  }

  private async resolveOrgForRefresh(userId: string, hintedOrgId?: string): Promise<string> {
    if (hintedOrgId) {
      const membership = await this.prisma.membership.findUnique({
        where: { userId_orgId: { userId, orgId: hintedOrgId } },
        select: { status: true },
      });
      if (membership?.status === MembershipStatus.ACTIVE) return hintedOrgId;
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const memberships = await this.prisma.membership.findMany({
      where: { userId, status: MembershipStatus.ACTIVE },
      select: { orgId: true, createdAt: true },
    });
    if (!user || !memberships.length) throw new UnauthorizedException('No active organization access');
    return this.pickActiveOrgId(user, memberships);
  }

  private async touchMembership(userId: string, orgId: string): Promise<void> {
    await this.prisma.membership.update({
      where: { userId_orgId: { userId, orgId } },
      data: { lastSeenAt: new Date() },
    });
  }

  private async logSwitch(
    userId: string,
    fromOrgId: string | null,
    toOrgId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.prisma.organizationSwitchLog.create({
      data: { userId, fromOrgId, toOrgId, ipAddress, userAgent },
    });
  }

  // Mirrors the given org's Membership onto the legacy single-org User columns, so any
  // code that hasn't been migrated to read Membership directly still sees a coherent
  // (if necessarily single-org) view. Membership stays the authoritative source.
  private async syncLegacyUserFields(userId: string, orgId: string): Promise<void> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
      include: { manager: { select: { userId: true } } },
    });
    if (!membership) return;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        orgId,
        role: membership.role,
        managerId: membership.manager?.userId ?? null,
        department: membership.department,
        jobTitle: membership.jobTitle,
        isActive: membership.status === MembershipStatus.ACTIVE,
        lastActiveOrganizationId: orgId,
      },
    });
  }

  private async buildAuthResponseUser(userId: string, activeOrgId: string): Promise<AuthResponseUser> {
    const [user, membership, memberships] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.membership.findUnique({
        where: { userId_orgId: { userId, orgId: activeOrgId } },
      }),
      this.prisma.membership.findMany({
        where: { userId, status: MembershipStatus.ACTIVE },
        include: { org: { select: { id: true, name: true, slug: true, logoUrl: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    if (!membership) throw new ForbiddenException("You don't have active access to this organization");

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      signatureUrl: user.signatureUrl,
      orgId: activeOrgId,
      jobTitle: membership.jobTitle,
      department: membership.department,
      role: membership.role,
      createdAt: user.createdAt,
      organizations: memberships.map((m) => ({
        id: m.org.id,
        name: m.org.name,
        slug: m.org.slug,
        logoUrl: m.org.logoUrl,
        role: m.role,
      })),
    };
  }

  private async generateTokens(userId: string, email: string, orgId: string, role: Role) {
    const payload = { sub: userId, email, orgId, role };

    const accessToken = this.jwt.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    });

    const refreshToken = this.jwt.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });

    await this.prisma.session.create({
      data: {
        userId,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken };
  }
}
