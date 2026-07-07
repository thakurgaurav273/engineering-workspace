import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ReviewType } from '@prisma/client';

export class CreateReviewDto {
  @ApiProperty({ enum: ReviewType })
  @IsEnum(ReviewType)
  type: ReviewType;

  @ApiProperty({ example: '2024-01-08', description: 'Must be a Monday (ISO date)' })
  @IsDateString()
  weekStart: string;

  @ApiPropertyOptional({ description: 'Required for manager reviews' })
  @IsOptional()
  @IsString()
  revieweeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  wins?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  challenges?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  learning?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}
