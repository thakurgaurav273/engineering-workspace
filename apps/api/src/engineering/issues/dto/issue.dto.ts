import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IssuePriority, IssueStatus } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

/** Comma-separated query values ("TODO,IN_PROGRESS") arrive as one string. */
const toList = ({ value }: { value: unknown }) =>
  value === undefined || value === ""
    ? undefined
    : (Array.isArray(value) ? value : String(value).split(",")).map((v) => String(v).trim());

const toBool = ({ value }: { value: unknown }) => value === true || value === "true";

export class CreateIssueDto {
  @ApiProperty()
  @IsString()
  teamId: string;

  @ApiProperty({ example: "Invoice sync drops line items" })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  description?: string;

  @ApiPropertyOptional({ enum: IssueStatus })
  @IsOptional()
  @IsEnum(IssueStatus)
  status?: IssueStatus;

  @ApiPropertyOptional({ enum: IssuePriority })
  @IsOptional()
  @IsEnum(IssuePriority)
  priority?: IssuePriority;

  @ApiPropertyOptional({ description: "Story points" })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(100)
  estimate?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  dueDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  assigneeId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  projectId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  cycleId?: string | null;

  @ApiPropertyOptional({ description: "Parent issue id (makes this a sub-issue)" })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  parentId?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  labelIds?: string[];
}

export class UpdateIssueDto extends PartialType(CreateIssueDto) {
  @ApiPropertyOptional({ description: "Manual position within its status column" })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export const ISSUE_ORDER = ["priority", "updated", "created", "dueDate", "manual"] as const;
export type IssueOrder = (typeof ISSUE_ORDER)[number];

export class ListIssuesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamId?: string;

  @ApiPropertyOptional({ description: "Comma-separated IssueStatus values" })
  @IsOptional()
  @Transform(toList)
  @IsEnum(IssueStatus, { each: true })
  status?: IssueStatus[];

  @ApiPropertyOptional({ description: "Comma-separated IssuePriority values" })
  @IsOptional()
  @Transform(toList)
  @IsEnum(IssuePriority, { each: true })
  priority?: IssuePriority[];

  @ApiPropertyOptional({ description: 'User id, "me", or "none" for unassigned' })
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'User id or "me"' })
  @IsOptional()
  @IsString()
  creatorId?: string;

  @ApiPropertyOptional({ description: 'Project id or "none"' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Cycle id, "current" (needs teamId) or "none"' })
  @IsOptional()
  @IsString()
  cycleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  labelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ description: "Hide sub-issues (only issues without a parent)" })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  topLevelOnly?: boolean;

  @ApiPropertyOptional({ description: "Exclude DONE and CANCELED" })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  activeOnly?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  archived?: boolean;

  @ApiPropertyOptional({ enum: ISSUE_ORDER, default: "manual" })
  @IsOptional()
  @IsIn(ISSUE_ORDER)
  orderBy?: IssueOrder;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 250 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 250;
}

export class IssueCommentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  body: string;
}
