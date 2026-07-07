import { Module } from '@nestjs/common';
import { CompanyModule } from '../company/company.module';
import { ClientsModule } from '../clients/clients.module';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';

/**
 * Business Operations — Proposals. Non-financial: imports only the Company and
 * Clients services it needs for snapshots. No numbering, no tax, no totals.
 */
@Module({
  imports: [CompanyModule, ClientsModule],
  controllers: [ProposalsController],
  providers: [ProposalsService],
  exports: [ProposalsService],
})
export class ProposalsModule {}
