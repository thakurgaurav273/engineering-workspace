import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DocumentTemplatesService } from './document-templates.service';
import { STARTER_TEMPLATES } from './starter-templates';

const caller = { sub: 'u-1', orgId: 'org-1', email: 'admin@acme.test' };

function template(overrides: Record<string, unknown> = {}) {
  return {
    id: 't-1',
    orgId: 'org-1',
    documentType: 'INVOICE',
    key: 'invoice_classic',
    name: 'Classic',
    description: null,
    status: 'DRAFT',
    draftHtml: STARTER_TEMPLATES[0].html,
    draftRevision: 3,
    hasUnpublishedChanges: true,
    liveVersion: null,
    isDefault: false,
    ...overrides,
  };
}

describe('DocumentTemplatesService', () => {
  let prisma: any;
  let platformRole: any;
  let service: DocumentTemplatesService;

  beforeEach(() => {
    prisma = {
      documentTemplate: {
        findFirst: jest.fn().mockResolvedValue(template()),
        findUnique: jest.fn().mockResolvedValue({ draftRevision: 3 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(template()),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(0),
      },
      documentTemplateVersion: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    prisma.$transaction = jest.fn((ops: unknown[]) => Promise.all(ops));
    platformRole = { isSuperAdmin: jest.fn().mockReturnValue(false) };
    service = new DocumentTemplatesService(prisma, { fromHtml: jest.fn() } as never, platformRole);
  });

  describe('publish', () => {
    it('freezes v1 and makes the first published template the org default', async () => {
      await service.publish('t-1', caller, { expectedRevision: 3, notes: 'First cut' });
      expect(prisma.documentTemplateVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ templateId: 't-1', version: 1, notes: 'First cut' }),
      });
      expect(prisma.documentTemplate.update.mock.calls[0][0].data).toEqual(
        expect.objectContaining({ liveVersion: 1, status: 'PUBLISHED', isDefault: true, hasUnpublishedChanges: false }),
      );
    });

    it('refuses a template with errors', async () => {
      prisma.documentTemplate.findFirst.mockResolvedValue(template({ draftHtml: '{% if %}' }));
      await expect(service.publish('t-1', caller, { expectedRevision: 3 })).rejects.toThrow(BadRequestException);
      expect(prisma.documentTemplateVersion.create).not.toHaveBeenCalled();
    });

    it('refuses a stale revision', async () => {
      await expect(service.publish('t-1', caller, { expectedRevision: 2 })).rejects.toThrow(ConflictException);
    });
  });

  it('rejects a draft save when someone else saved first', async () => {
    prisma.documentTemplate.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.saveDraft('t-1', caller, { expectedRevision: 3, html: '<p></p>' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('rolls back by republishing the old HTML as the next version', async () => {
    prisma.documentTemplate.findFirst.mockResolvedValue(template({ liveVersion: 4, status: 'PUBLISHED', isDefault: true }));
    prisma.documentTemplateVersion.findUnique.mockResolvedValue({ version: 2, html: '<p>v2</p>' });
    await service.rollback('t-1', caller, { version: 2 });
    expect(prisma.documentTemplateVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ version: 5, html: '<p>v2</p>', notes: 'Rolled back to v2' }),
    });
    expect(prisma.documentTemplate.update.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ draftHtml: '<p>v2</p>', liveVersion: 5 }),
    );
  });

  it('only lets super admins edit platform starters', async () => {
    prisma.documentTemplate.findFirst.mockResolvedValue(template({ orgId: null }));
    await expect(service.updateDetails('t-1', caller, { name: 'x' })).rejects.toThrow(ForbiddenException);
    await expect(service.create(caller, { documentType: 'INVOICE', name: 'Starter', platform: true })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("won't archive the default", async () => {
    prisma.documentTemplate.findFirst.mockResolvedValue(template({ isDefault: true, liveVersion: 1 }));
    await expect(service.setArchived('t-1', caller, true)).rejects.toThrow(BadRequestException);
  });

  describe('resolveSource', () => {
    it('prefers the pinned version', async () => {
      prisma.documentTemplateVersion.findUnique.mockResolvedValue({ id: 'v-9', html: '<p>pinned</p>' });
      const resolved = await service.resolveSource('org-1', 'INVOICE', { templateVersionId: 'v-9' });
      expect(resolved).toEqual({ source: '<p>pinned</p>', versionId: 'v-9' });
    });

    it("uses the org default's live version", async () => {
      prisma.documentTemplate.findFirst.mockResolvedValue(template({ liveVersion: 2, isDefault: true }));
      prisma.documentTemplateVersion.findUnique.mockResolvedValue({ id: 'v-2', html: '<p>live</p>' });
      const resolved = await service.resolveSource('org-1', 'INVOICE', {});
      expect(prisma.documentTemplate.findFirst).toHaveBeenCalledWith({
        where: { orgId: 'org-1', documentType: 'INVOICE', isDefault: true, liveVersion: { not: null } },
      });
      expect(resolved.versionId).toBe('v-2');
    });

    it('falls back to the built-in starter', async () => {
      prisma.documentTemplate.findFirst.mockResolvedValue(null);
      const resolved = await service.resolveSource('org-1', 'QUOTATION', {});
      expect(resolved).toEqual({ source: STARTER_TEMPLATES[1].html, versionId: null });
    });
  });

  it('creates from a built-in starter with a free key', async () => {
    prisma.documentTemplate.findMany.mockResolvedValue([{ key: 'my_invoice' }]);
    await service.create(caller, { documentType: 'INVOICE', name: 'My invoice', source: 'builtin:invoice_classic' });
    expect(prisma.documentTemplate.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ key: 'my_invoice_2', orgId: 'org-1', draftHtml: STARTER_TEMPLATES[0].html }),
    );
  });

  it('rejects a starter of another document type', async () => {
    await expect(
      service.create(caller, { documentType: 'QUOTATION', name: 'Q', source: 'builtin:invoice_classic' }),
    ).rejects.toThrow('That starter is for another document type');
  });
});
