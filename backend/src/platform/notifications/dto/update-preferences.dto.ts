import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  checkIns?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reviews?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  recognition?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  goals?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  linearActivity?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  systemAnnouncements?: boolean;
}
