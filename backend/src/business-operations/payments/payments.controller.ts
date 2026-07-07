import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../kernel/authorization/require-permission.decorator';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ListPaymentsDto } from './dto/list-payments.dto';

type Principal = { orgId?: string };

@UseGuards(JwtAuthGuard)
@Controller('business/payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @RequirePermission('business-operations:payment:read')
  list(@CurrentUser() user: Principal, @Query() query: ListPaymentsDto) {
    return this.payments.list(user.orgId!, query);
  }

  @Get(':id')
  @RequirePermission('business-operations:payment:read')
  findOne(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.payments.findOne(id, user.orgId!);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:payment:write')
  create(@CurrentUser() user: Principal, @Body() dto: CreatePaymentDto) {
    return this.payments.create(user.orgId!, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:payment:write')
  remove(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.payments.remove(id, user.orgId!);
  }
}
