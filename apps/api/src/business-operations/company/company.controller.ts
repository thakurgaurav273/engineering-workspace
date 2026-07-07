import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../kernel/authorization/require-permission.decorator';
import { CompanyService } from './company.service';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';

type Principal = { sub?: string; email?: string; orgId?: string };

/**
 * Company profile for the caller's organization. Read: any member. Write: OWNER/ADMIN.
 * Authorization reuses the platform model — RolesGuard authoritative, @RequirePermission
 * evaluated by the PDP in shadow mode.
 */
@UseGuards(JwtAuthGuard)
@Controller('business/company')
export class CompanyController {
  constructor(private readonly company: CompanyService) {}

  @Get()
  @RequirePermission('business-operations:company:read')
  get(@CurrentUser() user: Principal) {
    return this.company.getForOrg(user.orgId!);
  }

  @Patch()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:company:write')
  update(@CurrentUser() user: Principal, @Body() dto: UpdateCompanyProfileDto) {
    return this.company.upsert(user.orgId!, dto);
  }
}
