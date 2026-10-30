import { Module, OnModuleInit } from '@nestjs/common';
import { RegistryService } from '../kernel/registry/registry.service';
import { BusinessOperationsController } from './business-operations.controller';
import { businessOperationsApplication } from './business-operations.manifest';
import { CompanyModule } from './company/company.module';
import { ClientsModule } from './clients/clients.module';
import { DocumentNumberingModule } from './document-numbering/document-numbering.module';
import { TaxModule } from './tax/tax.module';
import { InvoicesModule } from './invoices/invoices.module';
import { QuotationsModule } from './quotations/quotations.module';
import { ProposalsModule } from './proposals/proposals.module';
import { PaymentsModule } from './payments/payments.module';
import { OfferLettersModule } from './offer-letters/offer-letters.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AiModule } from './ai/ai.module';
import { DocumentTemplatesModule } from './document-templates/document-templates.module';

/**
 * Business Operations - Application #2. Uniform one-line registration via the SDK; the
 * feature-flag gate lives in the manifest + registry. NO business logic / Prisma models.
 *
 * Designed to scale - domain logic lands as one feature module per area (mirrors
 * engineering/):
 *   business-operations/
 *     clients/  quotations/  invoices/  payments/  proposals/
 *     offer-letters/  company/  settings/  shared/
 */
@Module({
  imports: [CompanyModule, ClientsModule, DocumentNumberingModule, TaxModule, InvoicesModule, QuotationsModule, ProposalsModule, PaymentsModule, OfferLettersModule, DashboardModule, AiModule, DocumentTemplatesModule],
  controllers: [BusinessOperationsController],
})
export class BusinessOperationsModule implements OnModuleInit {
  constructor(private readonly registry: RegistryService) {}

  onModuleInit(): void {
    this.registry.register(businessOperationsApplication);
  }
}
