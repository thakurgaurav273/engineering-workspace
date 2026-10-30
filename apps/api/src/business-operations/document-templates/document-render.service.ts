import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PdfService } from '../../platform/pdf/pdf.service';
import { DocumentTemplatesService } from './document-templates.service';
import { pageNumberPosition, renderTemplate } from './template-engine';
import { TemplatedType } from './template-variables';
import { builtInStarter } from './starter-templates';

type PinnableModel = 'invoice' | 'quotation' | 'proposal' | 'offerLetter';

export interface RenderableDocument {
  id: string;
  status: string;
  templateId?: string | null;
  templateVersionId?: string | null;
}

/**
 * Renders a business document through the org's template. Documents that have left DRAFT are
 * pinned to the template version they first render with, so an issued invoice keeps its look
 * even after the template is republished. A broken org template falls back to the built-in
 * starter (logged) rather than blocking a download or send.
 */
@Injectable()
export class DocumentRenderService {
  private readonly logger = new Logger(DocumentRenderService.name);

  constructor(
    private prisma: PrismaService,
    private templates: DocumentTemplatesService,
    private pdf: PdfService,
  ) {}

  async html(
    type: TemplatedType,
    model: PinnableModel,
    orgId: string,
    doc: RenderableDocument,
    data: Record<string, unknown>,
  ): Promise<string> {
    const { source, versionId } = await this.templates.resolveSource(orgId, type, doc);
    if (versionId && !doc.templateVersionId && doc.status !== 'DRAFT') {
      await this.pin(model, doc.id, versionId);
    }
    try {
      return await renderTemplate(source, data);
    } catch (error) {
      this.logger.warn(`${type} ${doc.id}: template failed (${(error as Error).message}); using the built-in layout`);
      return renderTemplate(builtInStarter(type).html, data);
    }
  }

  toPdf(html: string): Promise<Buffer> {
    return this.pdf.fromHtml(html, { pageNumbers: pageNumberPosition(html) });
  }

  private async pin(model: PinnableModel, id: string, templateVersionId: string) {
    const data = { templateVersionId };
    const where = { id };
    switch (model) {
      case 'invoice':
        await this.prisma.invoice.update({ where, data });
        break;
      case 'quotation':
        await this.prisma.quotation.update({ where, data });
        break;
      case 'proposal':
        await this.prisma.proposal.update({ where, data });
        break;
      case 'offerLetter':
        await this.prisma.offerLetter.update({ where, data });
        break;
    }
  }
}
