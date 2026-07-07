import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InstallationState } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InstallationService } from './installation.service';

/**
 * On startup, ensures every organization has an INSTALLED record for each installable
 * application (create-missing only). Idempotent, never deletes, preserves existing state
 * and configuration. A DB failure is logged, not fatal.
 */
@Injectable()
export class InstallationBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(InstallationBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly installation: InstallationService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.sync();
    } catch (error) {
      this.logger.error(
        `Installation bootstrap skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async sync(): Promise<number> {
    const apps = this.installation.installableApps();
    const orgs = await this.prisma.organization.findMany({ select: { id: true } });
    const existing = await this.prisma.applicationInstallation.findMany({
      select: { orgId: true, applicationKey: true },
    });
    const have = new Set(existing.map((e) => `${e.orgId}|${e.applicationKey}`));

    const toCreate: { orgId: string; applicationKey: string; state: InstallationState }[] = [];
    for (const org of orgs) {
      for (const app of apps) {
        if (!have.has(`${org.id}|${app.key}`)) {
          toCreate.push({ orgId: org.id, applicationKey: app.key, state: InstallationState.INSTALLED });
        }
      }
    }
    if (toCreate.length) {
      await this.prisma.applicationInstallation.createMany({ data: toCreate, skipDuplicates: true });
    }
    this.logger.log(`Installation sync: ${toCreate.length} new record(s) for ${orgs.length} org(s)`);
    return toCreate.length;
  }
}
