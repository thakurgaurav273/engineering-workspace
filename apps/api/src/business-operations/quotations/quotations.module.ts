import { Module } from '@nestjs/common';
import { CompanyModule } from '../company/company.module';
import { ClientsModule } from '../clients/clients.module';
import { DocumentNumberingModule } from '../document-numbering/document-numbering.module';
import { TaxModule } from '../tax/tax.module';
import { MailModule } from '../../platform/mail/mail.module';
import { PdfModule } from '../../platform/pdf/pdf.module';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';

/** Business Operations — Quotations. Imports the four services it orchestrates. */
@Module({
  imports: [CompanyModule, ClientsModule, DocumentNumberingModule, TaxModule, MailModule, PdfModule],
  controllers: [QuotationsController],
  providers: [QuotationsService],
  exports: [QuotationsService],
})
export class QuotationsModule {}
