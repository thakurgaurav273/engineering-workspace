import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Platform-level role resolution — deliberately minimal and additive. SUPER_ADMIN is a
 * *platform* role that sits above any organization Owner; it is NOT an org membership
 * role and does NOT go through the PDP (which doesn't exist yet). It is sourced from an
 * env allowlist (`PLATFORM_SUPER_ADMINS`, comma-separated emails) so no schema, no
 * migration and no permission engine are required to introduce it.
 */
export type PlatformRole = 'SUPER_ADMIN';

@Injectable()
export class PlatformRoleService {
  private readonly logger = new Logger(PlatformRoleService.name);
  private readonly superAdmins: Set<string>;

  constructor(private readonly config: ConfigService) {
    this.superAdmins = this.load();
  }

  private load(): Set<string> {
    const raw = this.config.get<string>('PLATFORM_SUPER_ADMINS') ?? '';
    const emails = raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (emails.length) {
      this.logger.log(`Loaded ${emails.length} platform super admin(s)`);
    }
    return new Set(emails);
  }

  isSuperAdmin(email?: string | null): boolean {
    return !!email && this.superAdmins.has(email.toLowerCase());
  }

  /** The caller's platform role, or null. Distinct from their organization role. */
  platformRole(email?: string | null): PlatformRole | null {
    return this.isSuperAdmin(email) ? 'SUPER_ADMIN' : null;
  }
}
