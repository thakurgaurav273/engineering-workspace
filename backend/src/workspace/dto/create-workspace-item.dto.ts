import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { WorkspacePriority, WorkspaceSource } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateWorkspaceItemDto {
  @ApiProperty({ example: 'Call client tomorrow' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: 'Markdown-formatted notes' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @ApiPropertyOptional({ enum: WorkspacePriority, default: WorkspacePriority.MEDIUM })
  @IsOptional()
  @IsEnum(WorkspacePriority)
  priority?: WorkspacePriority;

  @ApiPropertyOptional({ example: '2024-03-31' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ enum: WorkspaceSource, default: WorkspaceSource.MANUAL })
  @IsOptional()
  @IsEnum(WorkspaceSource)
  source?: WorkspaceSource;

  @ApiPropertyOptional({ description: 'Assign this item to another org member - self if omitted' })
  @IsOptional()
  @IsString()
  ownerId?: string;
}
