import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { GoalStatus } from '@prisma/client';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto, UpdateGoalProgressDto } from './dto/update-goal.dto';
import { ListGoalsDto } from './dto/list-goals.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator';

@ApiTags('goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('goals')
export class GoalsController {
  constructor(private goalsService: GoalsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new goal' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateGoalDto) {
    return this.goalsService.create(user.sub, user.orgId, dto);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Get my goals' })
  @ApiQuery({ name: 'status', required: false, enum: GoalStatus })
  findMine(@CurrentUser() user: JwtPayload, @Query() query: ListGoalsDto) {
    const { status, ...pagination } = query;
    return this.goalsService.findMine(user.sub, user.orgId, pagination, status);
  }

  @Get()
  @ApiOperation({ summary: 'Get org goals' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: GoalStatus })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: ListGoalsDto) {
    const { userId, status, ...pagination } = query;
    return this.goalsService.findAll(user.orgId, pagination, userId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single goal with history' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.goalsService.findOne(id, user.orgId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update goal details' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.goalsService.update(id, user.sub, user.orgId, dto);
  }

  @Patch(':id/progress')
  @ApiOperation({ summary: 'Update goal progress (0-100)' })
  updateProgress(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateGoalProgressDto,
  ) {
    return this.goalsService.updateProgress(id, user.sub, user.orgId, dto);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Mark goal as complete' })
  complete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.goalsService.complete(id, user.sub, user.orgId);
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archive a goal' })
  archive(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.goalsService.archive(id, user.sub, user.orgId);
  }
}
