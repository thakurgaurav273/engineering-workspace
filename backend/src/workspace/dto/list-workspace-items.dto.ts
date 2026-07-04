import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString } from "class-validator";
import { WorkspacePriority, WorkspaceSource, WorkspaceStatus } from "@prisma/client";
import { PaginationDto } from "@/common/dto/pagination.dto";

const SORT_FIELDS = ["createdAt", "updatedAt", "dueDate", "priority", "title"] as const;
export type WorkspaceSortField = (typeof SORT_FIELDS)[number];

export class ListWorkspaceItemsDto extends PaginationDto {
  @ApiPropertyOptional({ description: "Matches title or description" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: WorkspaceStatus })
  @IsOptional()
  @IsEnum(WorkspaceStatus)
  status?: WorkspaceStatus;

  @ApiPropertyOptional({ enum: WorkspacePriority })
  @IsOptional()
  @IsEnum(WorkspacePriority)
  priority?: WorkspacePriority;

  @ApiPropertyOptional({ enum: WorkspaceSource })
  @IsOptional()
  @IsEnum(WorkspaceSource)
  source?: WorkspaceSource;

  @ApiPropertyOptional({ enum: SORT_FIELDS, default: "createdAt" })
  @IsOptional()
  @IsIn(SORT_FIELDS)
  sortBy?: WorkspaceSortField;

  @ApiPropertyOptional({ enum: ["asc", "desc"], default: "desc" })
  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc";

  @ApiPropertyOptional({ description: "Only items past their due date and not done" })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  overdue?: boolean;

  @ApiPropertyOptional({ description: "Only items due today" })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  dueToday?: boolean;

  @ApiPropertyOptional({ description: "Include archived items (excluded by default)" })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeArchived?: boolean;
}
