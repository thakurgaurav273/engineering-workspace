import { ApiPropertyOptional } from "@nestjs/swagger";
import { WorkspacePriority, WorkspaceSource } from "@prisma/client";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateWorkspaceItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @ApiPropertyOptional({ enum: WorkspacePriority })
  @IsOptional()
  @IsEnum(WorkspacePriority)
  priority?: WorkspacePriority;

  @ApiPropertyOptional({ description: "ISO date, or null to clear" })
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @ApiPropertyOptional({ enum: WorkspaceSource })
  @IsOptional()
  @IsEnum(WorkspaceSource)
  source?: WorkspaceSource;

  @ApiPropertyOptional({
    description: "Flags this as client-facing work, so the assignee can prioritize it",
  })
  @IsOptional()
  @IsBoolean()
  isClientProject?: boolean;
}
