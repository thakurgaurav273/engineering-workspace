import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";
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

  @ApiPropertyOptional({ description: "Hide sub-items - only items without a parent" })
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  topLevelOnly?: boolean;
}
