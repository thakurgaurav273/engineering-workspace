import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { CurrentUser, JwtPayload } from "@/common/decorators/current-user.decorator";
import { PrismaService } from "@/prisma/prisma.service";
import { IssuesService } from "./issues.service";
import { TeamsService } from "./teams.service";
import { ProjectsService } from "./projects.service";
import { CyclesService } from "./cycles.service";
import { LabelsService } from "./labels.service";
import { CreateIssueDto, IssueCommentDto, ListIssuesDto, UpdateIssueDto } from "./dto/issue.dto";
import { AddTeamMemberDto, CreateTeamDto, UpdateTeamDto } from "./dto/team.dto";
import { CreateProjectDto, ListProjectsDto, UpdateProjectDto } from "./dto/project.dto";
import { CompleteCycleDto, CreateCycleDto, UpdateCycleDto } from "./dto/cycle.dto";
import { CreateLabelDto, UpdateLabelDto } from "./dto/label.dto";

// The sub-resource controllers below are registered ahead of IssuesController in
// IssuesModule so `issues/teams` etc. aren't swallowed by its `issues/:id` routes.

@ApiTags("issues")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("issues/teams")
export class IssueTeamsController {
  constructor(private teams: TeamsService) {}

  @Get()
  @ApiQuery({ name: "includeArchived", required: false })
  list(@CurrentUser() user: JwtPayload, @Query("includeArchived") includeArchived?: string) {
    return this.teams.list(user, includeArchived === "true");
  }

  @Post()
  @ApiOperation({ summary: "Create a team (org admin) - the creator becomes its lead" })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTeamDto) {
    return this.teams.create(user, dto);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.teams.findOne(id, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @CurrentUser() user: JwtPayload, @Body() dto: UpdateTeamDto) {
    return this.teams.update(id, user, dto);
  }

  @Patch(":id/archive")
  archive(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.teams.setArchived(id, user, true);
  }

  @Patch(":id/unarchive")
  unarchive(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.teams.setArchived(id, user, false);
  }

  @Post(":id/members")
  addMember(@Param("id") id: string, @CurrentUser() user: JwtPayload, @Body() dto: AddTeamMemberDto) {
    return this.teams.addMember(id, user, dto);
  }

  @Delete(":id/members/:userId")
  removeMember(@Param("id") id: string, @Param("userId") userId: string, @CurrentUser() user: JwtPayload) {
    return this.teams.removeMember(id, userId, user);
  }
}

@ApiTags("issues")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("issues/projects")
export class IssueProjectsController {
  constructor(private projects: ProjectsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListProjectsDto) {
    return this.projects.list(user, query);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateProjectDto) {
    return this.projects.create(user, dto);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.projects.findOne(id, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @CurrentUser() user: JwtPayload, @Body() dto: UpdateProjectDto) {
    return this.projects.update(id, user, dto);
  }

  @Patch(":id/archive")
  archive(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.projects.setArchived(id, user, true);
  }

  @Patch(":id/unarchive")
  unarchive(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.projects.setArchived(id, user, false);
  }
}

@ApiTags("issues")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("issues/cycles")
export class IssueCyclesController {
  constructor(private cycles: CyclesService) {}

  @Get()
  @ApiQuery({ name: "teamId", required: true })
  list(@CurrentUser() user: JwtPayload, @Query("teamId") teamId: string) {
    return this.cycles.list(teamId, user);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCycleDto) {
    return this.cycles.create(user, dto);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.cycles.findOne(id, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @CurrentUser() user: JwtPayload, @Body() dto: UpdateCycleDto) {
    return this.cycles.update(id, user, dto);
  }

  @Post(":id/complete")
  complete(@Param("id") id: string, @CurrentUser() user: JwtPayload, @Body() dto: CompleteCycleDto) {
    return this.cycles.complete(id, user, dto);
  }
}

@ApiTags("issues")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("issues/labels")
export class IssueLabelsController {
  constructor(private labels: LabelsService) {}

  @Get()
  @ApiQuery({ name: "teamId", required: false })
  list(@CurrentUser() user: JwtPayload, @Query("teamId") teamId?: string) {
    return this.labels.list(user, teamId);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateLabelDto) {
    return this.labels.create(user, dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @CurrentUser() user: JwtPayload, @Body() dto: UpdateLabelDto) {
    return this.labels.update(id, user, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.labels.remove(id, user);
  }
}

@ApiTags("issues")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("issues")
export class IssuesController {
  constructor(
    private issues: IssuesService,
    private prisma: PrismaService,
  ) {}

  @Get("mode")
  @ApiOperation({
    summary:
      'Which tracker this org uses: "linear" (Linear connected - Task Updates) or "internal" (Issues)',
  })
  async mode(@CurrentUser() user: JwtPayload) {
    const org = await this.prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { linearApiKey: true },
    });
    return { mode: org?.linearApiKey ? "linear" : "internal" };
  }

  @Get("mine")
  @ApiOperation({ summary: "Open issues assigned to me, and ones I created for others" })
  mine(@CurrentUser() user: JwtPayload) {
    return this.issues.mine(user);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListIssuesDto) {
    return this.issues.list(user, query);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateIssueDto) {
    return this.issues.create(user, dto);
  }

  @Get(":id")
  @ApiOperation({ summary: 'Get an issue by id or identifier ("ENG-42")' })
  findOne(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.issues.findOne(id, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @CurrentUser() user: JwtPayload, @Body() dto: UpdateIssueDto) {
    return this.issues.update(id, user, dto);
  }

  @Patch(":id/archive")
  archive(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.issues.setArchived(id, user, true);
  }

  @Patch(":id/unarchive")
  unarchive(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.issues.setArchived(id, user, false);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.issues.remove(id, user);
  }

  @Get(":id/comments")
  listComments(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.issues.listComments(id, user);
  }

  @Post(":id/comments")
  addComment(@Param("id") id: string, @CurrentUser() user: JwtPayload, @Body() dto: IssueCommentDto) {
    return this.issues.addComment(id, user, dto);
  }

  @Patch(":id/comments/:commentId")
  editComment(
    @Param("id") id: string,
    @Param("commentId") commentId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: IssueCommentDto,
  ) {
    return this.issues.editComment(id, commentId, user, dto);
  }

  @Delete(":id/comments/:commentId")
  deleteComment(@Param("id") id: string, @Param("commentId") commentId: string, @CurrentUser() user: JwtPayload) {
    return this.issues.deleteComment(id, commentId, user);
  }
}
