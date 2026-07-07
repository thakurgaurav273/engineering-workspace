import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../kernel/authorization/require-permission.decorator';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { ListInvoicesDto } from './dto/list-invoices.dto';

type Principal = { orgId?: string };

@UseGuards(JwtAuthGuard)
@Controller('business/invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @RequirePermission('business-operations:invoice:read')
  list(@CurrentUser() user: Principal, @Query() query: ListInvoicesDto) {
    return this.invoices.list(user.orgId!, query);
  }

  @Get(':id')
  @RequirePermission('business-operations:invoice:read')
  findOne(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.invoices.findOne(id, user.orgId!);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:invoice:write')
  create(@CurrentUser() user: Principal, @Body() dto: CreateInvoiceDto) {
    return this.invoices.create(user.orgId!, dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:invoice:write')
  update(@CurrentUser() user: Principal, @Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    return this.invoices.update(id, user.orgId!, dto);
  }

  @Post(':id/issue')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:invoice:issue')
  issue(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.invoices.issue(id, user.orgId!);
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:invoice:write')
  cancel(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.invoices.cancel(id, user.orgId!);
  }

  @Post(':id/duplicate')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:invoice:write')
  duplicate(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.invoices.duplicate(id, user.orgId!);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:invoice:write')
  remove(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.invoices.remove(id, user.orgId!);
  }
}
