import { PartialType } from "@nestjs/swagger";
import { CreateWorkspaceCommentDto } from "./create-workspace-comment.dto";

export class UpdateWorkspaceCommentDto extends PartialType(CreateWorkspaceCommentDto) {}
