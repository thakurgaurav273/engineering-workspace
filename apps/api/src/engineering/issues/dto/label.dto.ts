import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreateLabelDto {
  @ApiProperty({ example: "Bug" })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name: string;

  @ApiPropertyOptional({ example: "#ef4444" })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: "color must be a hex value like #ef4444" })
  color?: string;

  @ApiPropertyOptional({ description: "Scope the label to one team; omitted = workspace-wide" })
  @IsOptional()
  @IsString()
  teamId?: string;
}

export class UpdateLabelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: "color must be a hex value like #ef4444" })
  color?: string;
}
