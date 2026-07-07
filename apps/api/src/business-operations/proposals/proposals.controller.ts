import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../kernel/authorization/require-permission.decorator';
import { ProposalsService } from './proposals.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { ListProposalsDto } from './dto/list-proposals.dto';

type Principal = { orgId?: string };

@UseGuards(JwtAuthGuard)
@Controller('business/proposals')
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  @Get()
  @RequirePermission('business-operations:proposal:read')
  list(@CurrentUser() user: Principal, @Query() query: ListProposalsDto) {
    return this.proposals.list(user.orgId!, query);
  }

  @Get(':id')
  @RequirePermission('business-operations:proposal:read')
  findOne(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.proposals.findOne(id, user.orgId!);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:proposal:write')
  create(@CurrentUser() user: Principal, @Body() dto: CreateProposalDto) {
    return this.proposals.create(user.orgId!, dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:proposal:write')
  update(@CurrentUser() user: Principal, @Param('id') id: string, @Body() dto: UpdateProposalDto) {
    return this.proposals.update(id, user.orgId!, dto);
  }

  @Get(':id/preview')
  @RequirePermission('business-operations:proposal:read')
  preview(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.proposals.preview(id, user.orgId!);
  }

  @Get(':id/pdf')
  @RequirePermission('business-operations:proposal:read')
  async pdf(@CurrentUser() user: Principal, @Param('id') id: string, @Res() res: Response) {
    const { fileName, buffer } = await this.proposals.toPdf(id, user.orgId!);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.send(buffer);
  }

  @Post(':id/send')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:proposal:send')
  send(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.proposals.send(id, user.orgId!);
  }

  @Post(':id/archive')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:proposal:write')
  archive(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.proposals.archive(id, user.orgId!);
  }

  @Post(':id/duplicate')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:proposal:write')
  duplicate(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.proposals.duplicate(id, user.orgId!);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:proposal:write')
  remove(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.proposals.remove(id, user.orgId!);
  }
}
