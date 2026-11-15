import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { GoalVisibility } from '@prisma/client';

export class CreateGoalDto {
  @ApiProperty({ example: 'Improve test coverage to 80%' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: '2024-03-31' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ enum: GoalVisibility, default: GoalVisibility.personal })
  @IsOptional()
  @IsEnum(GoalVisibility)
  visibility?: GoalVisibility;

  @ApiPropertyOptional({ description: 'Assign this goal to another user (admins only)' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Projects the goal is delivered through - replaces the current links',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  projectIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Issues the goal tracks directly - replaces the current links',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  issueIds?: string[];
}
