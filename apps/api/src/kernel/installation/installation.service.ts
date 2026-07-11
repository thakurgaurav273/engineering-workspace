import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InstallationState } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RegistryService } from '../registry/registry.service';
import { ApplicationManifest, ApplicationStatus } from '../registry/application-manifest';

/**
 * Per-organization application installation + configuration. Applications remain
 * registered globally (via the Registry/SDK); only their state is per-org. Platform-owned
 * apps (SUPER_ADMIN-only, e.g. Platform Administration) and platform chrome (Settings) are
 * NOT installable - they are always available and cannot be uninstalled/disabled.
 */
@Injectable()
export class InstallationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: RegistryService,
  ) {}

  /** Engineering / Business Operations etc. - launchable and not platform-owned. */
  isInstallable(manifest: ApplicationManifest): boolean {
    return !manifest.requiresSuperAdmin && manifest.showInLauncher !== false;
  }

  installableApps(): ApplicationManifest[] {
    return this.registry.list().filter((m) => this.isInstallable(m));
  }

  private ensureInstallable(applicationKey: string): void {
    const manifest = this.registry.get(applicationKey);
    if (!manifest) throw new NotFoundException(`Unknown application: ${applicationKey}`);
    if (!this.isInstallable(manifest)) {
      throw new BadRequestException(
        `Application "${applicationKey}" is platform-owned and cannot be installed, uninstalled, or disabled`,
      );
    }
  }

  private async setState(orgId: string, applicationKey: string, state: InstallationState) {
    this.ensureInstallable(applicationKey);
    return this.prisma.applicationInstallation.upsert({
      where: { orgId_applicationKey: { orgId, applicationKey } },
      create: { orgId, applicationKey, state },
      update: { state },
    });
  }

  install(orgId: string, applicationKey: string) {
    return this.setState(orgId, applicationKey, InstallationState.INSTALLED);
  }
  uninstall(orgId: string, applicationKey: string) {
    // Configuration is intentionally preserved.
    return this.setState(orgId, applicationKey, InstallationState.UNINSTALLED);
  }
  enable(orgId: string, applicationKey: string) {
    return this.setState(orgId, applicationKey, InstallationState.INSTALLED);
  }
  disable(orgId: string, applicationKey: string) {
    return this.setState(orgId, applicationKey, InstallationState.DISABLED);
  }

  /** Resolved state for an org+app; absence defaults to INSTALLED for installable apps. */
  async getStates(orgId: string): Promise<Map<string, InstallationState>> {
    const rows = await this.prisma.applicationInstallation.findMany({ where: { orgId } });
    return new Map(rows.map((r) => [r.applicationKey, r.state]));
  }

  /**
   * Filters/annotates a manifest list by an org's installation state. Non-installable apps
   * pass through untouched. UNINSTALLED/DISABLED are hidden; MAINTENANCE keeps the app but
   * surfaces the MAINTENANCE status (the shell already understands it). Everything flows
   * through the registry - no app-specific logic.
   */
  async applyInstallationState(
    manifests: ApplicationManifest[],
    orgId?: string,
  ): Promise<ApplicationManifest[]> {
    if (!orgId) return manifests;
    const states = await this.getStates(orgId);
    const out: ApplicationManifest[] = [];
    for (const manifest of manifests) {
      if (!this.isInstallable(manifest)) {
        out.push(manifest);
        continue;
      }
      const state = states.get(manifest.key) ?? InstallationState.INSTALLED;
      if (state === InstallationState.UNINSTALLED || state === InstallationState.DISABLED) continue;
      if (state === InstallationState.MAINTENANCE) {
        out.push({ ...manifest, status: ApplicationStatus.MAINTENANCE });
        continue;
      }
      out.push(manifest);
    }
    return out;
  }

  listAll() {
    return this.prisma.applicationInstallation.findMany({ orderBy: [{ orgId: 'asc' }, { applicationKey: 'asc' }] });
  }
  listByApplication(applicationKey: string) {
    return this.prisma.applicationInstallation.findMany({ where: { applicationKey }, orderBy: { orgId: 'asc' } });
  }
  async listByOrg(orgId: string) {
    const [installations, configs] = await Promise.all([
      this.prisma.applicationInstallation.findMany({ where: { orgId }, orderBy: { applicationKey: 'asc' } }),
      this.prisma.applicationConfiguration.findMany({ where: { orgId } }),
    ]);
    const configByApp = new Map(configs.map((c) => [c.applicationKey, c.config]));
    return installations.map((i) => ({ ...i, config: configByApp.get(i.applicationKey) ?? {} }));
  }

  async setConfiguration(orgId: string, applicationKey: string, config: object) {
    this.ensureInstallable(applicationKey);
    return this.prisma.applicationConfiguration.upsert({
      where: { orgId_applicationKey: { orgId, applicationKey } },
      create: { orgId, applicationKey, config: config as object },
      update: { config: config as object },
    });
  }
  async getConfiguration(orgId: string, applicationKey: string) {
    const row = await this.prisma.applicationConfiguration.findUnique({
      where: { orgId_applicationKey: { orgId, applicationKey } },
    });
    return row?.config ?? {};
  }
}
