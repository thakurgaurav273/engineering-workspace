import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DataManagementService } from './data-management.service';
import { AdminListQueryDto } from './dto/admin-list-query.dto';
import { BulkDeleteDto } from './dto/bulk-delete.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator';

@ApiTags('admin-data-management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'ADMIN')
@Controller('admin/data-management')
export class DataManagementController {
  constructor(private dataManagement: DataManagementService) {}

  // ---------------------------------------------------------------------------
  // Check-ins
  // ---------------------------------------------------------------------------

  @Get('check-ins')
  @ApiOperation({ summary: 'List check-ins across the org (admin)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  listCheckIns(@CurrentUser() user: JwtPayload, @Query() query: AdminListQueryDto) {
    return this.dataManagement.listCheckIns(user.orgId, query);
  }

  @Delete('check-ins/:id')
  @ApiOperation({ summary: 'Permanently delete a check-in (and any notifications referencing it)' })
  deleteCheckIn(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.dataManagement.deleteCheckIn(user.orgId, id);
  }

  @Post('check-ins/bulk-delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently bulk-delete check-ins (and any notifications referencing them)' })
  bulkDeleteCheckIns(@CurrentUser() user: JwtPayload, @Body() dto: BulkDeleteDto) {
    return this.dataManagement.bulkDeleteCheckIns(user.orgId, dto.ids);
  }

  // ---------------------------------------------------------------------------
  // Recognitions
  // ---------------------------------------------------------------------------

  @Get('recognitions')
  @ApiOperation({ summary: 'List recognitions across the org (admin)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  listRecognitions(@CurrentUser() user: JwtPayload, @Query() query: AdminListQueryDto) {
    return this.dataManagement.listRecognitions(user.orgId, query);
  }

  @Delete('recognitions/:id')
  @ApiOperation({ summary: 'Permanently delete a recognition (and any notifications referencing it)' })
  deleteRecognition(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.dataManagement.deleteRecognition(user.orgId, id);
  }

  @Post('recognitions/bulk-delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently bulk-delete recognitions (and any notifications referencing them)' })
  bulkDeleteRecognitions(@CurrentUser() user: JwtPayload, @Body() dto: BulkDeleteDto) {
    return this.dataManagement.bulkDeleteRecognitions(user.orgId, dto.ids);
  }

  // ---------------------------------------------------------------------------
  // Reviews
  // ---------------------------------------------------------------------------

  @Get('reviews')
  @ApiOperation({ summary: 'List weekly reviews across the org (admin)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  listReviews(@CurrentUser() user: JwtPayload, @Query() query: AdminListQueryDto) {
    return this.dataManagement.listReviews(user.orgId, query);
  }

  @Delete('reviews/:id')
  @ApiOperation({ summary: 'Permanently delete a review (and any notifications referencing it)' })
  deleteReview(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.dataManagement.deleteReview(user.orgId, id);
  }

  @Post('reviews/bulk-delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently bulk-delete reviews (and any notifications referencing them)' })
  bulkDeleteReviews(@CurrentUser() user: JwtPayload, @Body() dto: BulkDeleteDto) {
    return this.dataManagement.bulkDeleteReviews(user.orgId, dto.ids);
  }

  // ---------------------------------------------------------------------------
  // Goals
  // ---------------------------------------------------------------------------

  @Get('goals')
  @ApiOperation({ summary: 'List goals across the org (admin)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  listGoals(@CurrentUser() user: JwtPayload, @Query() query: AdminListQueryDto) {
    return this.dataManagement.listGoals(user.orgId, query);
  }

  @Delete('goals/:id')
  @ApiOperation({ summary: 'Permanently delete a goal (and any notifications referencing it)' })
  deleteGoal(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.dataManagement.deleteGoal(user.orgId, id);
  }

  @Post('goals/bulk-delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently bulk-delete goals (and any notifications referencing them)' })
  bulkDeleteGoals(@CurrentUser() user: JwtPayload, @Body() dto: BulkDeleteDto) {
    return this.dataManagement.bulkDeleteGoals(user.orgId, dto.ids);
  }

  // ---------------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------------

  @Get('notifications')
  @ApiOperation({ summary: 'List notifications across the org (admin)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  listNotifications(@CurrentUser() user: JwtPayload, @Query() query: AdminListQueryDto) {
    return this.dataManagement.listNotifications(user.orgId, query);
  }

  @Delete('notifications/:id')
  @ApiOperation({ summary: 'Permanently delete a notification' })
  deleteNotification(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.dataManagement.deleteNotification(user.orgId, id);
  }

  @Post('notifications/bulk-delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently bulk-delete notifications' })
  bulkDeleteNotifications(@CurrentUser() user: JwtPayload, @Body() dto: BulkDeleteDto) {
    return this.dataManagement.bulkDeleteNotifications(user.orgId, dto.ids);
  }
}
