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
}
