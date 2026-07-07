import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CheckInStatus } from '@prisma/client';

export class CreateCheckInDto {
  @ApiProperty({ enum: CheckInStatus })
  @IsEnum(CheckInStatus)
  status: CheckInStatus;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  summary: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  blockers?: string;
}
