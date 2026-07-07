import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../kernel/authorization/require-permission.decorator';
import { QuotationsService } from './quotations.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { ListQuotationsDto } from './dto/list-quotations.dto';

type Principal = { orgId?: string };

@UseGuards(JwtAuthGuard)
@Controller('business/quotations')
export class QuotationsController {
  constructor(private readonly quotations: QuotationsService) {}

  @Get()
  @RequirePermission('business-operations:quotation:read')
  list(@CurrentUser() user: Principal, @Query() query: ListQuotationsDto) {
    return this.quotations.list(user.orgId!, query);
  }

  @Get(':id')
  @RequirePermission('business-operations:quotation:read')
  findOne(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.quotations.findOne(id, user.orgId!);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:quotation:write')
  create(@CurrentUser() user: Principal, @Body() dto: CreateQuotationDto) {
    return this.quotations.create(user.orgId!, dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:quotation:write')
  update(@CurrentUser() user: Principal, @Param('id') id: string, @Body() dto: UpdateQuotationDto) {
    return this.quotations.update(id, user.orgId!, dto);
  }

  @Post(':id/issue')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:quotation:issue')
  issue(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.quotations.issue(id, user.orgId!);
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:quotation:write')
  cancel(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.quotations.cancel(id, user.orgId!);
  }

  @Post(':id/duplicate')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:quotation:write')
  duplicate(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.quotations.duplicate(id, user.orgId!);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:quotation:write')
  remove(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.quotations.remove(id, user.orgId!);
  }
}
