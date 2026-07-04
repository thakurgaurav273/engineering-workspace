import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PeopleService } from './people.service';
import { ListPeopleDto } from './dto/list-people.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';

@ApiTags('people')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('people')
export class PeopleController {
  constructor(private peopleService: PeopleService) {}

  @Get()
  @ApiOperation({ summary: 'List org members with search and filter' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'department', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: ListPeopleDto) {
    const { search, department, isActive, ...pagination } = query;
    return this.peopleService.findAll(
      user.orgId,
      pagination,
      search,
      department,
      isActive !== undefined ? isActive === 'true' : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get person profile' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.peopleService.findOne(id, user.orgId);
  }

  @Get(':id/check-ins')
  @ApiOperation({ summary: "Get a person's check-ins" })
  getCheckIns(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.peopleService.getCheckIns(id, user.orgId, pagination);
  }

  @Get(':id/goals')
  @ApiOperation({ summary: "Get a person's goals" })
  getGoals(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.peopleService.getGoals(id, user.orgId, pagination);
  }

  @Get(':id/reviews')
  @ApiOperation({ summary: "Get a person's reviews" })
  getReviews(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.peopleService.getReviews(id, user.orgId, pagination);
  }

  @Get(':id/recognitions')
  @ApiOperation({ summary: "Get a person's recognitions" })
  getRecognitions(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.peopleService.getRecognitions(id, user.orgId, pagination);
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Get performance timeline for a person (last 90 days)' })
  getTimeline(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.peopleService.getTimeline(id, user.orgId);
  }
}
