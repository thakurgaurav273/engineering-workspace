import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';

/**
 * Per-organization company profile. One profile per org (created lazily on first save).
 * Replaces the legacy single-tenant Company singleton.
 */
@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  /** The org's profile, or null when it has not been set up yet (empty state). */
  getForOrg(orgId: string) {
    return this.prisma.companyProfile.findUnique({ where: { orgId } });
  }

  /** Create or update the org's profile. */
  upsert(orgId: string, dto: UpdateCompanyProfileDto) {
    return this.prisma.companyProfile.upsert({
      where: { orgId },
      create: { orgId, ...dto },
      update: { ...dto },
    });
  }
}
