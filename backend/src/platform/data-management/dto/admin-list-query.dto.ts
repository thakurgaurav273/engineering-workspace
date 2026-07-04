import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class AdminListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Free-text search across the entity\'s text fields' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter to records belonging to/involving this user' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'ISO date — start of range (inclusive)' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date — end of range (inclusive)' })
  @IsOptional()
  @IsString()
  to?: string;
}
