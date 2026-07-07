import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { WorkspacePriority, WorkspaceSource } from "@prisma/client";

export class BoardQueryDto {
  @ApiPropertyOptional({ description: "Matches title or description" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: WorkspacePriority })
  @IsOptional()
  @IsEnum(WorkspacePriority)
  priority?: WorkspacePriority;

  @ApiPropertyOptional({ enum: WorkspaceSource })
  @IsOptional()
  @IsEnum(WorkspaceSource)
  source?: WorkspaceSource;
}
