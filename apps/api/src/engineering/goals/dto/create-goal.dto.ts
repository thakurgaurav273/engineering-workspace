import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
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
}
