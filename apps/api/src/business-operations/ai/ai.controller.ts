import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../kernel/authorization/require-permission.decorator';
import { AiService } from './ai.service';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';

type Principal = { orgId?: string };

@UseGuards(JwtAuthGuard)
@Controller('business/ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  /** Lets the UI show/hide the AI feature without exposing whether a key is set to non-members. */
  @Get('status')
  @RequirePermission('business-operations:invoice:read')
  status() {
    return { configured: this.ai.isConfigured() };
  }

  @Post('invoices')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:invoice:write')
  generateInvoice(@CurrentUser() user: Principal, @Body() dto: GenerateInvoiceDto) {
    return this.ai.generateInvoiceDraft(user.orgId!, dto);
  }
}
