import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateWorkspaceStatusDto {
  @ApiProperty({ enum: WorkspaceStatus })
  @IsEnum(WorkspaceStatus)
  status: WorkspaceStatus;
}
