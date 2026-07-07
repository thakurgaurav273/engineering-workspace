import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../kernel/authorization/require-permission.decorator';
import { DashboardService } from './dashboard.service';

type Principal = { orgId?: string };

@UseGuards(JwtAuthGuard)
@Controller('business/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  // Read-only financial overview. Reuses invoice:read (it is invoice-centric data).
  @Get()
  @RequirePermission('business-operations:invoice:read')
  summary(@CurrentUser() user: Principal) {
    return this.dashboard.summary(user.orgId!);
  }
}
