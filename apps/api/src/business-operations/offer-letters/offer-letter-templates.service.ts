import { Injectable } from '@nestjs/common';
import { EmploymentType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { defaultOfferLetterBody, EMPLOYMENT_TYPES } from './offer-letter-clauses';

export interface OfferLetterTemplateView {
  employmentType: EmploymentType;
  jobRole: string; // "" = the base template for the employment type
  content: string;
  isDefault: boolean; // true when no org override is saved yet (only possible for the base)
}

/** Trim + lowercase so role matching/uniqueness is case-insensitive ("SDE" == " sde "). */
function normRole(role?: string | null): string {
  return (role ?? '').trim();
}

/**
 * Per-org editable clause templates, keyed by (employment type × job role). A role of "" is the
 * BASE template for that employment type; named roles (e.g. "SDE") override the base when an
 * offer's position matches. When an org hasn't saved a base override, the built-in default clause
 * set is returned (and marked isDefault) so the Settings UI always has something to edit.
 * Templates may contain {{placeholders}} resolved when an offer is created.
 */
@Injectable()
export class OfferLetterTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every saved template plus a base entry (saved or built-in default) for each employment type. */
  async list(orgId: string): Promise<OfferLetterTemplateView[]> {
    const rows = await this.prisma.offerLetterTemplate.findMany({ where: { orgId } });
    const out: OfferLetterTemplateView[] = [];
    for (const employmentType of EMPLOYMENT_TYPES) {
      const forType = rows.filter((r) => r.employmentType === employmentType);
      const base = forType.find((r) => r.jobRole === '');
      out.push({
        employmentType,
        jobRole: '',
        content: base?.content ?? defaultOfferLetterBody(employmentType),
        isDefault: !base,
      });
      for (const role of forType.filter((r) => r.jobRole !== '').sort((a, b) => a.jobRole.localeCompare(b.jobRole))) {
        out.push({ employmentType, jobRole: role.jobRole, content: role.content, isDefault: false });
      }
    }
    return out;
  }

  async get(orgId: string, employmentType: EmploymentType, jobRole = ''): Promise<OfferLetterTemplateView> {
    const role = normRole(jobRole);
    const saved = await this.prisma.offerLetterTemplate.findUnique({
      where: { orgId_employmentType_jobRole: { orgId, employmentType, jobRole: role } },
    });
    return {
      employmentType,
      jobRole: role,
      // A new role template starts from the base override (or built-in default) as its seed.
      content: saved?.content ?? (await this.resolveContent(orgId, employmentType)),
      isDefault: !saved && role === '',
    };
  }

  async upsert(orgId: string, employmentType: EmploymentType, jobRole: string, content: string): Promise<OfferLetterTemplateView> {
    const role = normRole(jobRole);
    await this.prisma.offerLetterTemplate.upsert({
      where: { orgId_employmentType_jobRole: { orgId, employmentType, jobRole: role } },
      create: { orgId, employmentType, jobRole: role, content },
      update: { content },
    });
    return { employmentType, jobRole: role, content, isDefault: false };
  }

  /** Remove the override. A base reverts to the built-in default; a named role is deleted outright. */
  async reset(orgId: string, employmentType: EmploymentType, jobRole = ''): Promise<OfferLetterTemplateView> {
    const role = normRole(jobRole);
    await this.prisma.offerLetterTemplate.deleteMany({ where: { orgId, employmentType, jobRole: role } });
    return {
      employmentType,
      jobRole: role,
      content: role === '' ? defaultOfferLetterBody(employmentType) : '',
      isDefault: role === '',
    };
  }

  /**
   * The clause HTML to pre-fill a fresh offer with. Prefers a role-specific template matching the
   * offer's position (case-insensitive), then the org's base template, then the built-in default.
   */
  async resolveContent(orgId: string, employmentType: EmploymentType, role?: string | null): Promise<string> {
    const rows = await this.prisma.offerLetterTemplate.findMany({ where: { orgId, employmentType } });
    const wanted = normRole(role).toLowerCase();
    if (wanted) {
      const hit = rows.find((r) => r.jobRole && r.jobRole.toLowerCase() === wanted);
      if (hit) return hit.content;
    }
    const base = rows.find((r) => r.jobRole === '');
    return base?.content ?? defaultOfferLetterBody(employmentType);
  }
}
