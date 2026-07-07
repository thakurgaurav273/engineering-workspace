import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get full dashboard data for the organization' })
  getDashboard(@CurrentUser() user: JwtPayload) {
    return this.dashboardService.getDashboard(user.sub, user.orgId);
  }

  // @Res() takes this route out of the global ResponseInterceptor's envelope/JSON
  // pipeline entirely, since a CSV download can't be wrapped in {success, data}.
  @Get('export')
  @ApiOperation({ summary: 'Export dashboard metrics as CSV' })
  async exportDashboard(@CurrentUser() user: JwtPayload, @Res() res: Response) {
    const csv = await this.dashboardService.exportCsv(user.sub, user.orgId);
    const filename = `dashboard-export-${new Date().toISOString().slice(0, 10)}.csv`;
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(csv);
  }
}
