import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { calculateTax, TaxCalcInput, TaxSummary, TaxLineInput } from './tax-engine.util';
import { UpdateTaxConfigDto } from './dto/update-tax-config.dto';
import { CalculateTaxDto } from './dto/calculate-tax.dto';

const DEFAULT_CONFIG = {
  regime: 'IN_GST',
  homeCountry: 'India',
  defaultGstRate: 18,
  defaultVatRate: 0,
  priceMode: 'EXCLUSIVE' as const,
  roundingMode: 'NEAREST' as const,
};

@Injectable()
export class TaxService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(orgId: string) {
    const row = await this.prisma.taxConfig.findUnique({ where: { orgId } });
    return row ?? { orgId, ...DEFAULT_CONFIG };
  }

  async updateConfig(orgId: string, dto: UpdateTaxConfigDto) {
    return this.prisma.taxConfig.upsert({
      where: { orgId },
      create: { orgId, ...DEFAULT_CONFIG, ...dto },
      update: { ...dto },
    });
  }

  /**
   * The single source of truth for tax calculation. Fills unspecified options from the
   * org's config (price mode, rounding, home country, and a default tax per line), then
   * delegates to the pure engine.
   */
  async calculate(orgId: string, dto: CalculateTaxDto): Promise<TaxSummary> {
    const config = await this.getConfig(orgId);

    const items: TaxLineInput[] = dto.items.map((item) => ({
      ...item,
      taxes:
        item.taxes ??
        (item.exempt
          ? []
          : config.regime === 'IN_GST' && config.defaultGstRate > 0
            ? [{ type: 'GST' as const, rate: config.defaultGstRate }]
            : config.defaultVatRate > 0
              ? [{ type: 'VAT' as const, rate: config.defaultVatRate }]
              : []),
    }));

    const input: TaxCalcInput = {
      items,
      companyState: dto.companyState,
      customerState: dto.customerState,
      customerCountry: dto.customerCountry,
      customerHasGstin: dto.customerHasGstin,
      homeCountry: config.homeCountry,
      priceMode: dto.priceMode ?? config.priceMode,
      roundingMode: dto.roundingMode ?? config.roundingMode,
    };

    return calculateTax(input);
  }
}
