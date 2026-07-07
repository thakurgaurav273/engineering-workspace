import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateStatusDto {
  @ApiProperty()
  @IsBoolean()
  isActive: boolean;
}
