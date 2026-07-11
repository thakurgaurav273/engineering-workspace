import { Module } from '@nestjs/common';
import { TaxController } from './tax.controller';
import { TaxService } from './tax.service';

/**
 * Business Operations - Tax Engine. Exports TaxService so future document modules
 * (invoices, quotations, …) call TaxService.calculate() - the single source of truth.
 */
@Module({
  controllers: [TaxController],
  providers: [TaxService],
  exports: [TaxService],
})
export class TaxModule {}
