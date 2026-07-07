import { Module } from '@nestjs/common';
import { CompanyModule } from '../company/company.module';
import { ClientsModule } from '../clients/clients.module';
import { DocumentNumberingModule } from '../document-numbering/document-numbering.module';
import { TaxModule } from '../tax/tax.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

/**
 * Business Operations — Invoices. Imports the four services it orchestrates. It adds no
 * calculation logic of its own.
 */
@Module({
  imports: [CompanyModule, ClientsModule, DocumentNumberingModule, TaxModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
