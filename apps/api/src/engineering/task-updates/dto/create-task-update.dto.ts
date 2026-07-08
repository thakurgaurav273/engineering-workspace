import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TaskUpdateStatus } from '@prisma/client';
import { AttachmentInputDto } from '@/common/dto/attachment-input.dto';

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

  @ApiPropertyOptional({ type: [String], description: 'User ids @mentioned in the body' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  mentionedUserIds?: string[];

  @ApiPropertyOptional({ type: [AttachmentInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentInputDto)
  @ArrayMaxSize(10)
  attachments?: AttachmentInputDto[];
}
