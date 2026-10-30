import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString, MaxLength, ValidateIf } from "class-validator";

export class CreateCycleDto {
  @ApiProperty()
  @IsString()
  teamId: string;

  @ApiPropertyOptional({ example: "Sprint 14" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @ApiProperty()
  @IsDateString()
  startsAt: string;

  @ApiProperty()
  @IsDateString()
  endsAt: string;
}

export class UpdateCycleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(80)
  name?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

export class CompleteCycleDto {
  @ApiPropertyOptional({
    description: "Cycle to move unfinished issues into; omitted = they leave the cycle",
  })
  @IsOptional()
  @IsString()
  rolloverToCycleId?: string;
}
