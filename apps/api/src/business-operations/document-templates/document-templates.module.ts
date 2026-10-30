import { Module } from '@nestjs/common';
import { PdfModule } from '../../platform/pdf/pdf.module';
import { DocumentTemplatesController } from './document-templates.controller';
import { DocumentTemplatesService } from './document-templates.service';
import { DocumentRenderService } from './document-render.service';

/**
 * Business Operations - document templates: org-authored HTML/Liquid layouts for invoices,
 * quotations, proposals and offer letters. Exports DocumentRenderService, which the document
 * modules use for their preview / PDF / email output.
 */
@Module({
  imports: [PdfModule],
  controllers: [DocumentTemplatesController],
  providers: [DocumentTemplatesService, DocumentRenderService],
  exports: [DocumentRenderService],
})
export class DocumentTemplatesModule {}
