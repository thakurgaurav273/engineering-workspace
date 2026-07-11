import { Module } from '@nestjs/common';
import { DocumentNumberingController } from './document-numbering.controller';
import { DocumentNumberingService } from './document-numbering.service';

/**
 * Business Operations - Document Numbering. Exports DocumentNumberingService so future
 * document modules (invoices, quotations, …) can reserve numbers via `next()`.
 */
@Module({
  controllers: [DocumentNumberingController],
  providers: [DocumentNumberingService],
  exports: [DocumentNumberingService],
})
export class DocumentNumberingModule {}
