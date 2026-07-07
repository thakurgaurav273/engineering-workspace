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
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ListClientsDto } from './dto/list-clients.dto';

type Principal = { orgId?: string };

/**
 * Clients for the caller's organization. Read: any member. Write: OWNER/ADMIN (RolesGuard
 * authoritative). @RequirePermission adds PDP shadow coverage.
 */
@UseGuards(JwtAuthGuard)
@Controller('business/clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  @RequirePermission('business-operations:client:read')
  list(@CurrentUser() user: Principal, @Query() query: ListClientsDto) {
    return this.clients.list(user.orgId!, query);
  }

  @Get(':id')
  @RequirePermission('business-operations:client:read')
  findOne(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.clients.findOne(id, user.orgId!);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:client:write')
  create(@CurrentUser() user: Principal, @Body() dto: CreateClientDto) {
    return this.clients.create(user.orgId!, dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:client:write')
  update(@CurrentUser() user: Principal, @Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clients.update(id, user.orgId!, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:client:write')
  archive(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.clients.archive(id, user.orgId!);
  }

  @Post(':id/restore')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:client:write')
  restore(@CurrentUser() user: Principal, @Param('id') id: string) {
    return this.clients.restore(id, user.orgId!);
  }
}
