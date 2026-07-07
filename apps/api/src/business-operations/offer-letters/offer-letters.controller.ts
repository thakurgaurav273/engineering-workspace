import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../kernel/authorization/require-permission.decorator';
import { OfferLettersService } from './offer-letters.service';
import { CreateOfferLetterDto } from './dto/create-offer-letter.dto';
import { UpdateOfferLetterDto } from './dto/update-offer-letter.dto';
import { ListOfferLettersDto } from './dto/list-offer-letters.dto';

type Principal = { orgId?: string };

@UseGuards(JwtAuthGuard)
@Controller('business/offer-letters')
export class OfferLettersController {
  constructor(private readonly offers: OfferLettersService) {}

  @Get()
  @RequirePermission('business-operations:offer-letter:read')
  list(@CurrentUser() user: Principal, @Query() query: ListOfferLettersDto) {
    return this.offers.list(user.orgId!, query);
  }

  @Get(':id')
  @RequirePermission('business-operations:offer-letter:read')
  findOne(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.offers.findOne(id, user.orgId!);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:offer-letter:write')
  create(@CurrentUser() user: Principal, @Body() dto: CreateOfferLetterDto) {
    return this.offers.create(user.orgId!, dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:offer-letter:write')
  update(@CurrentUser() user: Principal, @Param('id') id: string, @Body() dto: UpdateOfferLetterDto) {
    return this.offers.update(id, user.orgId!, dto);
  }

  @Post(':id/send')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:offer-letter:send')
  send(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.offers.send(id, user.orgId!);
  }

  @Post(':id/accept')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:offer-letter:write')
  accept(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.offers.accept(id, user.orgId!);
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:offer-letter:write')
  reject(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.offers.reject(id, user.orgId!);
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:offer-letter:write')
  cancel(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.offers.cancel(id, user.orgId!);
  }

  @Post(':id/duplicate')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:offer-letter:write')
  duplicate(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.offers.duplicate(id, user.orgId!);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:offer-letter:write')
  remove(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.offers.remove(id, user.orgId!);
  }
}
