import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Post('devices')
  @ApiOperation({ summary: 'Register or update a push notification device (idempotent by token)' })
  registerDevice(@CurrentUser() user: JwtPayload, @Body() dto: RegisterDeviceDto) {
    return this.notifications.registerDevice(user.sub, user.orgId, dto);
  }

  @Delete('devices/:token')
  @ApiOperation({ summary: 'Unregister a push notification device' })
  unregisterDevice(@CurrentUser() user: JwtPayload, @Param('token') token: string) {
    return this.notifications.unregisterDevice(user.sub, token);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get my notification category preferences' })
  getPreferences(@CurrentUser() user: JwtPayload) {
    return this.notifications.getPreferences(user.sub);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update my notification category preferences' })
  updatePreferences(@CurrentUser() user: JwtPayload, @Body() dto: UpdatePreferencesDto) {
    return this.notifications.updatePreferences(user.sub, dto);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get my unread notification count' })
  unreadCount(@CurrentUser() user: JwtPayload) {
    return this.notifications.unreadCount(user.sub, user.orgId);
  }

  @Get()
  @ApiOperation({ summary: 'List my notifications' })
  findMine(@CurrentUser() user: JwtPayload, @Query() query: ListNotificationsDto) {
    return this.notifications.list(user.sub, user.orgId, query);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  markAllRead(@CurrentUser() user: JwtPayload) {
    return this.notifications.markAllRead(user.sub, user.orgId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  markRead(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.notifications.markRead(id, user.sub, user.orgId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Dismiss (delete) a single notification' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.notifications.remove(id, user.sub, user.orgId);
  }
}
