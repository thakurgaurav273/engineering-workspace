import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DocumentTemplate, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PdfService, allowedAssetHosts } from '../../platform/pdf/pdf.service';
import { PlatformRoleService } from '../../kernel/platform-role/platform-role.service';
import { prefillBody } from '../offer-letters/offer-letter-clauses';
import {
  CreateTemplateDto,
  ListTemplatesDto,
  PreviewDto,
  RevisionDto,
  RollbackDto,
  SaveDraftDto,
  UpdateTemplateDto,
} from './dto/document-template.dto';
import {
  MAX_TEMPLATE_LENGTH,
  TEMPLATE_FILTERS,
  TemplateIssue,
  TemplateRenderError,
  lintTemplate,
  pageNumberPosition,
  renderTemplate,
} from './template-engine';
import {
  TEMPLATE_VARIABLES,
  TEMPLATED_TYPES,
  TemplatedType,
  invoiceContext,
  offerLetterContext,
  proposalContext,
  quotationContext,
  sampleContext,
} from './template-variables';
import { BLANK_TEMPLATE, STARTER_TEMPLATES, builtInStarter } from './starter-templates';

export interface Caller {
  sub?: string;
  orgId?: string;
  email?: string;
}

const summarySelect = {
  id: true,
  orgId: true,
  documentType: true,
  key: true,
  name: true,
  description: true,
  status: true,
  draftRevision: true,
  draftUpdatedAt: true,
  hasUnpublishedChanges: true,
  liveVersion: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DocumentTemplateSelect;

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
  return /^[a-z]/.test(slug) ? slug : `t_${slug || 'template'}`;
}

/**
 * Org-authored HTML/Liquid layouts for business documents, with the same lifecycle as a
 * publishing CMS: edit a draft (optimistic revision), validate, publish an immutable version,
 * roll back, and pick one published template per document type as the org default.
 * Platform starters (orgId null) follow the same flow but only super admins may edit them.
 */
@Injectable()
export class DocumentTemplatesService {
  private readonly logger = new Logger(DocumentTemplatesService.name);

  constructor(
    private prisma: PrismaService,
    private pdf: PdfService,
    private platformRole: PlatformRoleService,
  ) {}

  // ---------------------------------------------------------------- catalog

  /** Everything the editor needs that isn't a template: variables, formatters, starters, limits. */
  catalog() {
    return {
      documentTypes: TEMPLATED_TYPES,
      variables: TEMPLATE_VARIABLES,
      filters: TEMPLATE_FILTERS,
      starters: STARTER_TEMPLATES.map(({ html: _html, ...s }) => ({ ...s, source: `builtin:${s.key}` })),
      limits: { maxHtmlLength: MAX_TEMPLATE_LENGTH, allowedAssetHosts: allowedAssetHosts() },
    };
  }

  // ---------------------------------------------------------------- reads

  async list(caller: Caller, query: ListTemplatesDto) {
    const orgId = query.platform ? null : this.org(caller);
    return this.prisma.documentTemplate.findMany({
      where: {
        orgId,
        ...(query.documentType && { documentType: query.documentType }),
        ...(query.includeArchived ? {} : { status: { not: 'ARCHIVED' } }),
      },
      select: summarySelect,
      orderBy: [{ documentType: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  /** Starting points for "New template": built-ins plus published platform starters. */
  async starters(documentType?: TemplatedType) {
    const platform = await this.prisma.documentTemplate.findMany({
      where: { orgId: null, status: 'PUBLISHED', ...(documentType && { documentType }) },
      select: { id: true, key: true, name: true, description: true, documentType: true },
      orderBy: { name: 'asc' },
    });
    return [
      ...STARTER_TEMPLATES.filter((s) => !documentType || s.documentType === documentType).map(
        ({ html: _html, ...s }) => ({ ...s, source: `builtin:${s.key}`, origin: 'built-in' as const }),
      ),
      ...platform.map((p) => ({ ...p, source: `template:${p.id}`, origin: 'platform' as const })),
    ];
  }

  async get(id: string, caller: Caller) {
    const template = await this.findVisible(id, caller);
    return { ...template, issues: await this.lint(template.draftHtml, template.documentType as TemplatedType) };
  }

  async versions(id: string, caller: Caller) {
    await this.findVisible(id, caller);
    return this.prisma.documentTemplateVersion.findMany({
      where: { templateId: id },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, notes: true, publishedById: true, createdAt: true },
    });
  }

  async events(id: string, caller: Caller) {
    await this.findVisible(id, caller);
    return this.prisma.documentTemplateEvent.findMany({
      where: { templateId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // ---------------------------------------------------------------- writes

  async create(caller: Caller, dto: CreateTemplateDto) {
    const orgId = dto.platform ? null : this.org(caller);
    if (orgId === null) this.assertSuperAdmin(caller);

    const html = await this.sourceHtml(caller, dto.documentType, dto.source);
    const baseKey = dto.key ?? slugify(dto.name);
    const key = dto.key ? baseKey : await this.freeKey(orgId, baseKey);
    try {
      const template = await this.prisma.documentTemplate.create({
        data: {
          orgId,
          documentType: dto.documentType,
          key,
          name: dto.name.trim(),
          description: dto.description,
          draftHtml: html,
          createdById: caller.sub,
          events: { create: { action: 'created', actorId: caller.sub, notes: dto.source ?? 'blank' } },
        },
        select: summarySelect,
      });
      return template;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`A template with key "${key}" already exists`);
      }
      throw error;
    }
  }

  async updateDetails(id: string, caller: Caller, dto: UpdateTemplateDto) {
    await this.findEditable(id, caller);
    return this.prisma.documentTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description }),
        events: { create: { action: 'details_updated', actorId: caller.sub } },
      },
      select: summarySelect,
    });
  }

  /** Saves the draft if nobody else saved since `expectedRevision`; returns lint issues. */
  async saveDraft(id: string, caller: Caller, dto: SaveDraftDto) {
    const template = await this.findEditable(id, caller);
    const { count } = await this.prisma.documentTemplate.updateMany({
      where: { id, draftRevision: dto.expectedRevision },
      data: {
        draftHtml: dto.html,
        draftRevision: { increment: 1 },
        draftUpdatedAt: new Date(),
        hasUnpublishedChanges: true,
      },
    });
    if (count === 0) {
      const current = await this.prisma.documentTemplate.findUnique({ where: { id }, select: { draftRevision: true } });
      throw new ConflictException({
        message: 'Someone else saved this template since you opened it. Reload to get their changes.',
        currentRevision: current?.draftRevision,
      });
    }
    const saved = await this.prisma.documentTemplate.findUniqueOrThrow({ where: { id }, select: summarySelect });
    return { ...saved, issues: await this.lint(dto.html, template.documentType as TemplatedType) };
  }

  async discardDraft(id: string, caller: Caller, dto: RevisionDto) {
    const template = await this.findEditable(id, caller);
    if (!template.liveVersion) throw new BadRequestException('Nothing published yet - there is no version to go back to');
    const live = await this.version(id, template.liveVersion);
    await this.guardRevision(id, dto.expectedRevision);
    return this.prisma.documentTemplate.update({
      where: { id },
      data: {
        draftHtml: live.html,
        draftRevision: { increment: 1 },
        draftUpdatedAt: new Date(),
        hasUnpublishedChanges: false,
        events: { create: { action: 'draft_discarded', actorId: caller.sub, version: template.liveVersion } },
      },
      select: summarySelect,
    });
  }

  /** Lints + renders the draft with sample data; blocks on any error, then freezes a new version. */
  async publish(id: string, caller: Caller, dto: RevisionDto) {
    const template = await this.findEditable(id, caller);
    await this.guardRevision(id, dto.expectedRevision);
    const issues = await this.check(template.draftHtml, template.documentType as TemplatedType);
    if (issues.some((i) => i.severity === 'error')) {
      throw new BadRequestException({ message: 'Fix the errors before publishing', issues });
    }
    return this.release(template, template.draftHtml, caller, 'published', dto.notes);
  }

  /** Republishes an old version's HTML as the next version (history stays append-only). */
  async rollback(id: string, caller: Caller, dto: RollbackDto) {
    const template = await this.findEditable(id, caller);
    const old = await this.version(id, dto.version);
    return this.release(template, old.html, caller, 'rolled_back', dto.notes ?? `Rolled back to v${dto.version}`, true);
  }

  async setDefault(id: string, caller: Caller) {
    const template = await this.findEditable(id, caller);
    if (template.orgId === null) throw new BadRequestException('Platform starters can\'t be an org default - copy it first');
    if (!template.liveVersion || template.status === 'ARCHIVED') {
      throw new BadRequestException('Only a published template can be the default');
    }
    await this.prisma.$transaction([
      this.prisma.documentTemplate.updateMany({
        where: { orgId: template.orgId, documentType: template.documentType, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.documentTemplate.update({
        where: { id },
        data: { isDefault: true, events: { create: { action: 'set_default', actorId: caller.sub } } },
      }),
    ]);
    return this.prisma.documentTemplate.findUniqueOrThrow({ where: { id }, select: summarySelect });
  }

  async setArchived(id: string, caller: Caller, archived: boolean) {
    const template = await this.findEditable(id, caller);
    if (archived && template.isDefault) {
      throw new BadRequestException('Make another template the default before archiving this one');
    }
    return this.prisma.documentTemplate.update({
      where: { id },
      data: {
        status: archived ? 'ARCHIVED' : template.liveVersion ? 'PUBLISHED' : 'DRAFT',
        events: { create: { action: archived ? 'archived' : 'restored', actorId: caller.sub } },
      },
      select: summarySelect,
    });
  }

  // ---------------------------------------------------------------- preview

  /** Lint + sample render, for the editor's Problems panel. */
  async validate(caller: Caller, dto: PreviewDto) {
    this.org(caller);
    return { issues: await this.check(dto.html, dto.documentType, dto.documentId, caller) };
  }

  async preview(caller: Caller, dto: PreviewDto): Promise<{ html: string } | { pdf: Buffer }> {
    const data = dto.documentId
      ? await this.documentContext(dto.documentType, dto.documentId, this.org(caller))
      : sampleContext(dto.documentType);
    let html: string;
    try {
      html = await renderTemplate(dto.html, data);
    } catch (error) {
      if (error instanceof TemplateRenderError) {
        throw new BadRequestException({ message: error.message, issues: [error.issue] });
      }
      throw error;
    }
    if (dto.format !== 'pdf') return { html };
    return { pdf: await this.pdf.fromHtml(html, { pageNumbers: pageNumberPosition(html) }) };
  }

  async previewVersion(id: string, version: number, caller: Caller): Promise<Buffer> {
    const template = await this.findVisible(id, caller);
    const { html: source } = await this.version(id, version);
    const html = await renderTemplate(source, sampleContext(template.documentType as TemplatedType));
    return this.pdf.fromHtml(html, { pageNumbers: pageNumberPosition(html) });
  }

  // ---------------------------------------------------------------- document rendering

  /**
   * The template source a document renders with: its pinned version, else its chosen
   * template's live version, else the org default's, else the built-in starter.
   */
  async resolveSource(
    orgId: string,
    type: TemplatedType,
    doc: { templateId?: string | null; templateVersionId?: string | null },
  ): Promise<{ source: string; versionId: string | null }> {
    if (doc.templateVersionId) {
      const pinned = await this.prisma.documentTemplateVersion.findUnique({ where: { id: doc.templateVersionId } });
      if (pinned) return { source: pinned.html, versionId: pinned.id };
    }
    const template = await this.prisma.documentTemplate.findFirst({
      where: doc.templateId
        ? { id: doc.templateId, orgId, liveVersion: { not: null } }
        : { orgId, documentType: type, isDefault: true, liveVersion: { not: null } },
    });
    if (template?.liveVersion) {
      const live = await this.prisma.documentTemplateVersion.findUnique({
        where: { templateId_version: { templateId: template.id, version: template.liveVersion } },
      });
      if (live) return { source: live.html, versionId: live.id };
    }
    return { source: builtInStarter(type).html, versionId: null };
  }

  /** Published templates an org can pick for a document of this type. */
  choices(caller: Caller, documentType: TemplatedType) {
    return this.prisma.documentTemplate.findMany({
      where: { orgId: this.org(caller), documentType, liveVersion: { not: null }, status: { not: 'ARCHIVED' } },
      select: { id: true, name: true, isDefault: true, liveVersion: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  // ---------------------------------------------------------------- internals

  private org(caller: Caller): string {
    if (!caller.orgId) throw new ForbiddenException('No organization in scope');
    return caller.orgId;
  }

  private assertSuperAdmin(caller: Caller) {
    if (!this.platformRole.isSuperAdmin(caller.email)) {
      throw new ForbiddenException('Only platform super admins can manage platform starters');
    }
  }

  /** Org templates are visible to that org; platform starters to everyone. */
  private async findVisible(id: string, caller: Caller): Promise<DocumentTemplate> {
    const template = await this.prisma.documentTemplate.findFirst({
      where: { id, OR: [{ orgId: caller.orgId ?? '__none__' }, { orgId: null }] },
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  private async findEditable(id: string, caller: Caller): Promise<DocumentTemplate> {
    const template = await this.findVisible(id, caller);
    if (template.orgId === null) this.assertSuperAdmin(caller);
    return template;
  }

  private async guardRevision(id: string, expected: number) {
    const current = await this.prisma.documentTemplate.findUnique({ where: { id }, select: { draftRevision: true } });
    if (current?.draftRevision !== expected) {
      throw new ConflictException({
        message: 'The draft changed since you loaded it. Reload, then try again.',
        currentRevision: current?.draftRevision,
      });
    }
  }

  private async version(templateId: string, version: number) {
    const found = await this.prisma.documentTemplateVersion.findUnique({
      where: { templateId_version: { templateId, version } },
    });
    if (!found) throw new NotFoundException(`Version ${version} not found`);
    return found;
  }

  private async release(
    template: DocumentTemplate,
    html: string,
    caller: Caller,
    action: 'published' | 'rolled_back',
    notes?: string,
    syncDraft = false,
  ) {
    const next = (template.liveVersion ?? 0) + 1;
    // An org's first published template of a type becomes its default automatically.
    const needsDefault =
      template.orgId !== null &&
      !template.isDefault &&
      !(await this.prisma.documentTemplate.count({
        where: { orgId: template.orgId, documentType: template.documentType, isDefault: true },
      }));
    await this.prisma.$transaction([
      this.prisma.documentTemplateVersion.create({
        data: { templateId: template.id, version: next, html, notes, publishedById: caller.sub },
      }),
      this.prisma.documentTemplate.update({
        where: { id: template.id },
        data: {
          liveVersion: next,
          status: 'PUBLISHED',
          hasUnpublishedChanges: false,
          ...(needsDefault && { isDefault: true }),
          ...(syncDraft && { draftHtml: html, draftRevision: { increment: 1 }, draftUpdatedAt: new Date() }),
          events: { create: { action, version: next, notes, actorId: caller.sub } },
        },
      }),
    ]);
    return this.prisma.documentTemplate.findUniqueOrThrow({ where: { id: template.id }, select: summarySelect });
  }

  private lint(html: string, type: TemplatedType) {
    return lintTemplate(html, TEMPLATE_VARIABLES[type]);
  }

  /** Lint, then (if it parses) render with sample or real data to surface runtime errors. */
  private async check(html: string, type: TemplatedType, documentId?: string, caller?: Caller): Promise<TemplateIssue[]> {
    const issues = await this.lint(html, type);
    if (issues.some((i) => i.severity === 'error')) return issues;
    const data = documentId && caller ? await this.documentContext(type, documentId, this.org(caller)) : sampleContext(type);
    try {
      await renderTemplate(html, data);
    } catch (error) {
      if (error instanceof TemplateRenderError) issues.push(error.issue);
      else throw error;
    }
    return issues;
  }

  private async sourceHtml(caller: Caller, type: TemplatedType, source?: string): Promise<string> {
    if (!source || source === 'blank') return BLANK_TEMPLATE('{{ document.title }} {{ document.number }}');
    if (source.startsWith('builtin:')) {
      const starter = STARTER_TEMPLATES.find((s) => s.key === source.slice('builtin:'.length));
      if (!starter) throw new BadRequestException('Unknown starter');
      if (starter.documentType !== type) throw new BadRequestException('That starter is for another document type');
      return starter.html;
    }
    if (source.startsWith('template:')) {
      const from = await this.findVisible(source.slice('template:'.length), caller);
      if (from.documentType !== type) throw new BadRequestException('That template is for another document type');
      // Copy what's live when there is a live version (that's what "starter" means), else the draft.
      if (from.liveVersion) return (await this.version(from.id, from.liveVersion)).html;
      return from.draftHtml;
    }
    throw new BadRequestException('source must be "blank", "builtin:<key>" or "template:<id>"');
  }

  private async freeKey(orgId: string | null, base: string): Promise<string> {
    const taken = new Set(
      (
        await this.prisma.documentTemplate.findMany({
          where: { orgId, key: { startsWith: base } },
          select: { key: true },
        })
      ).map((t) => t.key),
    );
    if (!taken.has(base)) return base;
    for (let i = 2; ; i++) if (!taken.has(`${base}_${i}`)) return `${base}_${i}`;
  }

  /** A real document of this org as template data (drafts use the live company profile). */
  private async documentContext(type: TemplatedType, id: string, orgId: string): Promise<Record<string, unknown>> {
    const company = await this.prisma.companyProfile.findUnique({ where: { orgId } });
    const live = <T extends { status: string; companySnapshot: Prisma.JsonValue }>(doc: T): T =>
      doc.status === 'DRAFT' && company ? { ...doc, companySnapshot: company as unknown as Prisma.JsonValue } : doc;
    const notFound = () => new NotFoundException('Document not found');
    switch (type) {
      case 'INVOICE': {
        const doc = await this.prisma.invoice.findFirst({ where: { id, orgId }, include: { lines: true, sections: true } });
        if (!doc) throw notFound();
        return invoiceContext(live(doc));
      }
      case 'QUOTATION': {
        const doc = await this.prisma.quotation.findFirst({ where: { id, orgId }, include: { lines: true, sections: true } });
        if (!doc) throw notFound();
        return quotationContext(live(doc));
      }
      case 'PROPOSAL': {
        const doc = await this.prisma.proposal.findFirst({ where: { id, orgId }, include: { sections: true } });
        if (!doc) throw notFound();
        return proposalContext(live(doc));
      }
      case 'OFFER_LETTER': {
        const doc = await this.prisma.offerLetter.findFirst({ where: { id, orgId } });
        if (!doc) throw notFound();
        const body = doc.bodyContent?.trim() ? doc.bodyContent : prefillBody(doc);
        return offerLetterContext(live(doc), body);
      }
    }
  }
}

