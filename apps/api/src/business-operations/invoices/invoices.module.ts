import { Module } from '@nestjs/common';
import { CompanyModule } from '../company/company.module';
import { ClientsModule } from '../clients/clients.module';
import { DocumentNumberingModule } from '../document-numbering/document-numbering.module';
import { TaxModule } from '../tax/tax.module';
import { MailModule } from '../../platform/mail/mail.module';
import { PdfModule } from '../../platform/pdf/pdf.module';
import { DocumentTemplatesModule } from '../document-templates/document-templates.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

/**
 * Business Operations - Invoices. Imports the four services it orchestrates. It adds no
 * calculation logic of its own.
 */
@Module({
  imports: [CompanyModule, ClientsModule, DocumentNumberingModule, TaxModule, MailModule, PdfModule, DocumentTemplatesModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
