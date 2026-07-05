import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LinearWorkflowType } from '@prisma/client';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class ListIssuesDto extends PaginationDto {
  @ApiPropertyOptional({ enum: LinearWorkflowType })
  @IsOptional()
  @IsEnum(LinearWorkflowType)
  state?: LinearWorkflowType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description:
      'Comma-separated membership user IDs - OWNER/ADMIN only, ignored otherwise. ' +
      'Also accepts the sentinels "__all__" (every assignee, including unmatched/unassigned ' +
      'Linear issues) and "__unassigned__" (only issues with no matched assignee).',
  })
  @IsOptional()
  @IsString()
  userIds?: string;
}
