import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator';

@ApiTags('invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(private invitationsService: InvitationsService) {}

  @Public()
  @Get('token/:token')
  @ApiOperation({ summary: 'Preview an invitation by token (public)' })
  findByToken(@Param('token') token: string) {
    return this.invitationsService.findByToken(token);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Post()
  @ApiOperation({ summary: 'Invite a teammate by email' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateInvitationDto) {
    return this.invitationsService.create(dto, user.orgId, user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Get()
  @ApiOperation({ summary: 'List pending invitations for the org' })
  findAllPending(@CurrentUser() user: JwtPayload) {
    return this.invitationsService.findAllPending(user.orgId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a pending invitation' })
  revoke(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.invitationsService.revoke(id, user.orgId);
  }
}
