import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { WorkspaceService } from "./workspace.service";
import { ImageUploadUrlDto } from "@/platform/storage/dto/image-upload.dto";
import { CreateWorkspaceItemDto } from "./dto/create-workspace-item.dto";
import { UpdateWorkspaceItemDto } from "./dto/update-workspace-item.dto";
import { UpdateWorkspaceStatusDto } from "./dto/update-workspace-status.dto";
import { ListWorkspaceItemsDto } from "./dto/list-workspace-items.dto";
import { BoardQueryDto } from "./dto/board-query.dto";
import { CreateWorkspaceCommentDto } from "./dto/create-workspace-comment.dto";
import { UpdateWorkspaceCommentDto } from "./dto/update-workspace-comment.dto";
import { DelegateWorkspaceItemDto } from "./dto/delegate-workspace-item.dto";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { CurrentUser, JwtPayload } from "@/common/decorators/current-user.decorator";

@ApiTags("workspace")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("workspace")
export class WorkspaceController {
  constructor(private workspaceService: WorkspaceService) {}

  @Post()
  @ApiOperation({ summary: "Create an action item - for yourself or (if permitted) a teammate" })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateWorkspaceItemDto) {
    return this.workspaceService.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: "List my action items - paginated, searchable, filterable, sortable" })
  findMine(@CurrentUser() user: JwtPayload, @Query() query: ListWorkspaceItemsDto) {
    return this.workspaceService.findMine(user, query);
  }

  @Get("board")
  @ApiOperation({ summary: "Kanban board - my items grouped by status column, searchable/filterable" })
  getBoard(@CurrentUser() user: JwtPayload, @Query() query: BoardQueryDto) {
    return this.workspaceService.getBoard(user, query);
  }

  @Get("assigned")
  @ApiOperation({
    summary: "Items I've assigned to teammates - so I can see what's already delegated",
  })
  findAssignedByMe(@CurrentUser() user: JwtPayload, @Query() query: ListWorkspaceItemsDto) {
    return this.workspaceService.findAssignedByMe(user, query);
  }

  @Get("summary")
  @ApiOperation({
    summary:
      "Pending/in-progress/done/overdue/due-today counts (self or, with access, another user)",
  })
  @ApiQuery({ name: "userId", required: false })
  getSummary(@CurrentUser() user: JwtPayload, @Query("userId") userId?: string) {
    return this.workspaceService.getSummary(user, userId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single action item" })
  findOne(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.workspaceService.findOne(id, user);
  }

  @Post("comment-attachments/upload-url")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Presigned URL to upload a comment image attachment" })
  createCommentAttachmentUploadUrl(@CurrentUser() user: JwtPayload, @Body() dto: ImageUploadUrlDto) {
    return this.workspaceService.createCommentAttachmentUploadUrl(user.orgId, dto);
  }

  @Get(":id/comments")
  @ApiOperation({ summary: "List comments on an action item" })
  listComments(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.workspaceService.listComments(id, user);
  }

  @Post(":id/comments")
  @ApiOperation({ summary: "Comment on an action item - notifies the owner/assigner" })
  addComment(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: CreateWorkspaceCommentDto,
  ) {
    return this.workspaceService.addComment(id, user, dto);
  }

  @Patch(":id/comments/:commentId")
  @ApiOperation({ summary: "Edit your own comment" })
  editComment(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Param("commentId") commentId: string,
    @Body() dto: UpdateWorkspaceCommentDto,
  ) {
    return this.workspaceService.editComment(id, commentId, user, dto);
  }

  @Delete(":id/comments/:commentId")
  @ApiOperation({ summary: "Delete a comment (author or an admin)" })
  deleteComment(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Param("commentId") commentId: string,
  ) {
    return this.workspaceService.deleteComment(id, commentId, user);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update title/description/priority/dueDate/source" })
  update(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: UpdateWorkspaceItemDto,
  ) {
    return this.workspaceService.update(id, user, dto);
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Move between board columns (drag & drop)" })
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: UpdateWorkspaceStatusDto,
  ) {
    return this.workspaceService.updateStatus(id, user, dto);
  }

  @Patch(":id/delegate")
  @ApiOperation({
    summary: "Hand this item off to a teammate - the current owner's watchers stay in the loop",
  })
  delegate(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: DelegateWorkspaceItemDto,
  ) {
    return this.workspaceService.delegate(id, user, dto);
  }

  @Patch(":id/archive")
  @ApiOperation({ summary: "Archive a completed item" })
  archive(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.workspaceService.archive(id, user);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Soft-delete an action item" })
  remove(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.workspaceService.remove(id, user);
  }
}
