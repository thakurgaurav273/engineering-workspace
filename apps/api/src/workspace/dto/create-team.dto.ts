import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export const TEAM_ROLES = ["LEAD", "MEMBER"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export class CreateTeamDto {
  @ApiProperty({ example: "Platform" })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: "PLT", description: "Short unique key within the org (A-Z, 0-9)" })
  @IsString()
  @Matches(/^[A-Z0-9]{2,10}$/, { message: "key must be 2-10 uppercase letters or digits" })
  key: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class UpdateTeamDto extends PartialType(CreateTeamDto) {}

export class AddTeamMemberDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiPropertyOptional({ enum: TEAM_ROLES, default: "MEMBER" })
  @IsOptional()
  @IsIn(TEAM_ROLES)
  role?: TeamRole;
}
