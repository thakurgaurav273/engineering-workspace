import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { TaskUpdateStatus } from '@prisma/client';

export class CreateTaskUpdateDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  body: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @ApiProperty({ enum: TaskUpdateStatus })
  @IsEnum(TaskUpdateStatus)
  status: TaskUpdateStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  timeSpentMinutes?: number;
}
