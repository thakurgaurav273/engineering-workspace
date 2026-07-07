import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

export class ProposalSectionDto {
  @IsString() @MaxLength(300) title!: string;
  // Plain rich-text HTML. No markdown renderer yet; stored verbatim.
  @IsOptional() @IsString() @MaxLength(100000) content?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) order?: number;
}

export class CreateProposalDto {
  @IsOptional() @IsString() clientId?: string;
  @IsOptional() @IsString() @MaxLength(200) clientName?: string;
  @IsString() @MaxLength(300) title!: string;
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
  @IsOptional() @IsString() @MaxLength(4000) summary?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProposalSectionDto)
  sections?: ProposalSectionDto[];
}
