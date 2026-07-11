import { Module } from '@nestjs/common';
import { CompanyModule } from '../company/company.module';
import { ClientsModule } from '../clients/clients.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

/**
 * Business Operations - AI drafting. Turns a natural-language prompt into an invoice draft via
 * Hugging Face, then reuses InvoicesService to persist it. No new numbering/tax logic; no new
 * permission (reuses invoice:read/write). Inert unless HF_API_KEY is set.
 */
@Module({
  imports: [CompanyModule, ClientsModule, InvoicesModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
