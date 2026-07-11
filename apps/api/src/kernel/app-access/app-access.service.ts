import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InstallationService } from '../installation/installation.service';
import { ApplicationManifest } from '../registry/application-manifest';

/**
 * Per-user application access - the third and finest layer of the visibility model, below the
 * registry (status + SUPER_ADMIN) and the per-org installation state. Deny-by-default: a member
 * sees an *installable* application only when a grant row exists for them. A platform SUPER_ADMIN
 * bypasses this entirely, and non-installable apps (platform chrome like Settings, or SUPER_ADMIN
 * -only apps) are never gated here - they flow through untouched, exactly like the installation
 * layer treats them.
 */
@Injectable()
export class AppAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly installation: InstallationService,
  ) {}

  /** Application keys this user is currently granted within the org. */
  async grantedKeys(orgId: string, userId: string): Promise<Set<string>> {
    const rows = await this.prisma.userApplicationAccess.findMany({
      where: { orgId, userId, granted: true },
      select: { applicationKey: true },
    });
    return new Set(rows.map((r) => r.applicationKey));
  }

  /**
   * Filters a manifest list by a user's per-app grants. Non-installable apps pass through; SUPER
   * _ADMIN sees everything. Everything else flows through the registry/installation - no app-
   * specific logic here.
   */
  async filterByUserAccess(
    manifests: ApplicationManifest[],
    opts: { orgId?: string; userId?: string; isSuperAdmin: boolean },
  ): Promise<ApplicationManifest[]> {
    if (opts.isSuperAdmin || !opts.orgId || !opts.userId) return manifests;
    const granted = await this.grantedKeys(opts.orgId, opts.userId);
    return manifests.filter((m) => !this.installation.isInstallable(m) || granted.has(m.key));
  }

  /**
   * The full access matrix for an org: every active member, every installable application, and
   * which apps each member is granted. Powers the Platform Administration → App Access screen.
   */
  async accessMatrix(orgId: string) {
    const [memberships, grants] = await Promise.all([
      this.prisma.membership.findMany({
        where: { orgId, status: 'ACTIVE' },
        select: {
          role: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
        orderBy: { user: { firstName: 'asc' } },
      }),
      this.prisma.userApplicationAccess.findMany({
        where: { orgId, granted: true },
        select: { userId: true, applicationKey: true },
      }),
    ]);

    const grantedByUser = new Map<string, string[]>();
    for (const g of grants) {
      const list = grantedByUser.get(g.userId) ?? [];
      list.push(g.applicationKey);
      grantedByUser.set(g.userId, list);
    }

    const applications = this.installation.installableApps().map((m) => ({
      key: m.key,
      name: m.name,
      description: m.description,
      status: m.status,
      icon: m.icon,
    }));

    const users = memberships
      .filter((m) => m.user)
      .map((m) => ({
        id: m.user.id,
        email: m.user.email,
        name: `${m.user.firstName} ${m.user.lastName}`.trim(),
        role: m.role,
        grantedKeys: grantedByUser.get(m.user.id) ?? [],
      }));

    return { applications, users };
  }

  /**
   * Grant or revoke a single app for a single user. Validates that the app is installable (grants
   * are meaningless for platform-owned/chrome apps) and that the user is an active member of the org.
   */
  async setAccess(params: {
    orgId: string;
    userId: string;
    applicationKey: string;
    granted: boolean;
    grantedById?: string;
  }) {
    const { orgId, userId, applicationKey, granted, grantedById } = params;

    const manifest = this.installation
      .installableApps()
      .find((m) => m.key === applicationKey);
    if (!manifest) {
      throw new BadRequestException(
        `Application "${applicationKey}" is not an installable application and cannot be granted per user`,
      );
    }

    const membership = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
      select: { status: true },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new NotFoundException(`User is not an active member of this organization`);
    }

    return this.prisma.userApplicationAccess.upsert({
      where: { orgId_userId_applicationKey: { orgId, userId, applicationKey } },
      create: { orgId, userId, applicationKey, granted, grantedById },
      update: { granted, grantedById },
    });
  }
}
