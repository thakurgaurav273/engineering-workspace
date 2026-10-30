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
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { TeamService } from "./team.service";
import { WorkspaceService } from "./workspace.service";
import { ListWorkspaceItemsDto } from "./dto/list-workspace-items.dto";
import { AddTeamMemberDto, CreateTeamDto, UpdateTeamDto } from "./dto/create-team.dto";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { CurrentUser, JwtPayload } from "@/common/decorators/current-user.decorator";

// Registered ahead of WorkspaceController in WorkspaceModule so `workspace/teams`
// is matched here instead of being swallowed by WorkspaceController's `:id` routes.
@ApiTags("workspace")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("workspace/teams")
export class TeamController {
  constructor(
    private teamService: TeamService,
    private workspaceService: WorkspaceService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List teams in my organization" })
  @ApiQuery({ name: "includeArchived", required: false })
  list(@CurrentUser() user: JwtPayload, @Query("includeArchived") includeArchived?: string) {
    return this.teamService.list(user, includeArchived === "true");
  }

  @Post()
  @ApiOperation({ summary: "Create a team (org admin) - the creator becomes its lead" })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTeamDto) {
    return this.teamService.create(user, dto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a team with its members" })
  findOne(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.teamService.findOne(id, user);
  }

  @Get(":id/items")
  @ApiOperation({ summary: "Items filed under a team - read-only for members, any for admins" })
  items(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Query() query: ListWorkspaceItemsDto,
  ) {
    return this.workspaceService.findTeamItems(id, user, query);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a team (admin or team lead)" })
  update(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateTeamDto) {
    return this.teamService.update(id, user, dto);
  }

  @Patch(":id/archive")
  @ApiOperation({ summary: "Archive a team (org admin)" })
  archive(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.teamService.archive(id, user);
  }

  @Post(":id/members")
  @ApiOperation({ summary: "Add a member, or change their role (admin or team lead)" })
  addMember(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: AddTeamMemberDto,
  ) {
    return this.teamService.addMember(id, user, dto);
  }

  @Delete(":id/members/:userId")
  @ApiOperation({ summary: "Remove a member, or leave the team yourself" })
  removeMember(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Param("userId") userId: string,
  ) {
    return this.teamService.removeMember(id, userId, user);
  }
}
