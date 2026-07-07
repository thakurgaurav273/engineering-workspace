import { Injectable } from '@nestjs/common';
import { EmploymentType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { defaultOfferLetterBody, EMPLOYMENT_TYPES } from './offer-letter-clauses';

export interface OfferLetterTemplateView {
  employmentType: EmploymentType;
  content: string;
  isDefault: boolean; // true when no org override is saved yet
}

/**
 * Per-org, per-employment-type editable clause templates. When an org hasn't saved an override,
 * the built-in default clause set is returned (and marked isDefault) so the Settings UI always
 * has something to edit. Templates may contain {{placeholders}} resolved when an offer is created.
 */
@Injectable()
export class OfferLetterTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string): Promise<OfferLetterTemplateView[]> {
    const rows = await this.prisma.offerLetterTemplate.findMany({ where: { orgId } });
    const byType = new Map(rows.map((r) => [r.employmentType, r]));
    return EMPLOYMENT_TYPES.map((employmentType) => {
      const saved = byType.get(employmentType);
      return {
        employmentType,
        content: saved?.content ?? defaultOfferLetterBody(employmentType),
        isDefault: !saved,
      };
    });
  }

  async get(orgId: string, employmentType: EmploymentType): Promise<OfferLetterTemplateView> {
    const saved = await this.prisma.offerLetterTemplate.findUnique({
      where: { orgId_employmentType: { orgId, employmentType } },
    });
    return {
      employmentType,
      content: saved?.content ?? defaultOfferLetterBody(employmentType),
      isDefault: !saved,
    };
  }

  async upsert(orgId: string, employmentType: EmploymentType, content: string): Promise<OfferLetterTemplateView> {
    await this.prisma.offerLetterTemplate.upsert({
      where: { orgId_employmentType: { orgId, employmentType } },
      create: { orgId, employmentType, content },
      update: { content },
    });
    return { employmentType, content, isDefault: false };
  }

  /** Remove the override, reverting this type to the built-in default. */
  async reset(orgId: string, employmentType: EmploymentType): Promise<OfferLetterTemplateView> {
    await this.prisma.offerLetterTemplate.deleteMany({ where: { orgId, employmentType } });
    return { employmentType, content: defaultOfferLetterBody(employmentType), isDefault: true };
  }
}
