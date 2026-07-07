import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../kernel/authorization/require-permission.decorator';
import { TaxService } from './tax.service';
import { UpdateTaxConfigDto } from './dto/update-tax-config.dto';
import { CalculateTaxDto } from './dto/calculate-tax.dto';

type Principal = { orgId?: string };

/**
 * Tax configuration + the canonical calculation endpoint. Read/calculate: any member.
 * Config write: OWNER/ADMIN. Future document modules call TaxService.calculate() directly.
 */
@UseGuards(JwtAuthGuard)
@Controller('business/tax')
export class TaxController {
  constructor(private readonly tax: TaxService) {}

  @Get('config')
  @RequirePermission('business-operations:tax:read')
  getConfig(@CurrentUser() user: Principal) {
    return this.tax.getConfig(user.orgId!);
  }

  @Patch('config')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:tax:write')
  updateConfig(@CurrentUser() user: Principal, @Body() dto: UpdateTaxConfigDto) {
    return this.tax.updateConfig(user.orgId!, dto);
  }

  @Post('calculate')
  @RequirePermission('business-operations:tax:read')
  calculate(@CurrentUser() user: Principal, @Body() dto: CalculateTaxDto) {
    return this.tax.calculate(user.orgId!, dto);
  }
}
