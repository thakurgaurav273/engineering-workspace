import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { TaskUpdatesService } from './task-updates.service';
import { CreateTaskUpdateDto } from './dto/create-task-update.dto';
import { UpdateTaskUpdateDto } from './dto/update-task-update.dto';
import { ListIssuesDto } from './dto/list-issues.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';

@ApiTags('task-updates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('task-updates')
export class TaskUpdatesController {
  constructor(private taskUpdatesService: TaskUpdatesService) {}

  @Get('issues')
  @ApiOperation({ summary: 'List my assigned Linear issues' })
  @ApiQuery({ name: 'state', required: false })
  @ApiQuery({ name: 'search', required: false })
  listMyIssues(@CurrentUser() user: JwtPayload, @Query() query: ListIssuesDto) {
    return this.taskUpdatesService.listMyIssues(user.sub, user.orgId, query);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Get all my task updates across every issue' })
  findMine(@CurrentUser() user: JwtPayload, @Query() pagination: PaginationDto) {
    return this.taskUpdatesService.findMine(user.sub, user.orgId, pagination);
  }

  @Get('team')
  @ApiOperation({ summary: "Cross-person activity feed — my reports, or the whole org for OWNER/ADMIN" })
  getTeamFeed(@CurrentUser() user: JwtPayload, @Query() pagination: PaginationDto) {
    return this.taskUpdatesService.getTeamFeed(user, user.orgId, pagination);
  }

  @Post('sync')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Manually trigger a Linear sync for this org' })
  triggerSync(@CurrentUser() user: JwtPayload) {
    return this.taskUpdatesService.triggerSync(user.orgId);
  }

  @Get('sync/status')
  @ApiOperation({ summary: 'Last sync time, issue count, and Linear connection state' })
  getSyncStatus(@CurrentUser() user: JwtPayload) {
    return this.taskUpdatesService.getSyncStatus(user.orgId);
  }

  @Get('users/:userId')
  @ApiOperation({ summary: "One person's issues + updates — self, their manager, or OWNER/ADMIN" })
  getUserActivity(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.taskUpdatesService.getUserActivity(userId, user.orgId, user, pagination);
  }

  @Get('issues/:issueId')
  @ApiOperation({ summary: 'Issue detail with its update timeline' })
  getIssueDetail(
    @CurrentUser() user: JwtPayload,
    @Param('issueId') issueId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.taskUpdatesService.getIssueDetail(issueId, user.orgId, user, pagination);
  }

  @Post('issues/:issueId/updates')
  @ApiOperation({ summary: 'Post a task update against an issue (assignee only)' })
  postUpdate(
    @CurrentUser() user: JwtPayload,
    @Param('issueId') issueId: string,
    @Body() dto: CreateTaskUpdateDto,
  ) {
    return this.taskUpdatesService.postUpdate(issueId, user.orgId, user.sub, dto);
  }

  @Patch('updates/:id')
  @ApiOperation({ summary: 'Edit my own task update' })
  editUpdate(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateTaskUpdateDto) {
    return this.taskUpdatesService.editUpdate(id, user.orgId, user.sub, dto);
  }

  @Delete('updates/:id')
  @ApiOperation({ summary: 'Soft-delete a task update (author, their manager, or OWNER/ADMIN)' })
  deleteUpdate(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.taskUpdatesService.deleteUpdate(id, user.orgId, user);
  }
}
