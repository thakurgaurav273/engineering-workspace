import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IssueStateCategory } from "@prisma/client";
import { IsEnum, IsNumber, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreateStateDto {
  @ApiProperty()
  @IsString()
  teamId: string;

  @ApiProperty({ example: "In QA" })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name: string;

  @ApiProperty({ enum: IssueStateCategory })
  @IsEnum(IssueStateCategory)
  category: IssueStateCategory;

  @ApiPropertyOptional({ example: "#f59e0b" })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: "color must be a hex value like #f59e0b" })
  color?: string;
}

export class UpdateStateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name?: string;

  @ApiPropertyOptional({ enum: IssueStateCategory })
  @IsOptional()
  @IsEnum(IssueStateCategory)
  category?: IssueStateCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: "color must be a hex value like #f59e0b" })
  color?: string;

  @ApiPropertyOptional({ description: "Order within its category" })
  @IsOptional()
  @IsNumber()
  position?: number;
}

export class DeleteStateDto {
  @ApiPropertyOptional({ description: "State that takes over this state's issues (required if it has any)" })
  @IsOptional()
  @IsString()
  replacementStateId?: string;
}
