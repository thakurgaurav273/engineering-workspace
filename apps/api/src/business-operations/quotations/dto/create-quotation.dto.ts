import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { TaxSelectionDto } from '../../tax/dto/calculate-tax.dto';

export class QuotationLineDto {
  @IsString() @MaxLength(500) description!: string;
  @IsOptional() @IsNumber() @Min(0) quantity?: number;
  @IsOptional() @IsString() @MaxLength(20) unit?: string;
  @IsNumber() @Min(0) unitPrice!: number;
  @IsOptional() @IsNumber() @Min(0) discount?: number;
  @IsOptional() @IsIn(['PERCENT', 'FIXED']) discountType?: 'PERCENT' | 'FIXED';
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => TaxSelectionDto) taxes?: TaxSelectionDto[];
}

export class QuotationSectionDto {
  @IsString() @MaxLength(300) title!: string;
  // Plain rich-text HTML. No markdown renderer yet; stored verbatim.
  @IsOptional() @IsString() @MaxLength(100000) content?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) order?: number;
}

export class CreateQuotationDto {
  @IsOptional() @IsString() clientId?: string;
  @IsOptional() @IsString() @MaxLength(200) clientName?: string;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
  @IsOptional() @IsString() @MaxLength(4000) terms?: string;
  @IsOptional() @IsDateString() expiryDate?: string;
  @IsOptional() @IsIn(['EXCLUSIVE', 'INCLUSIVE']) priceMode?: string;
  // A published template to render with; '' = the org default.
  @IsOptional() @IsString() @MaxLength(60) templateId?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => QuotationLineDto) lines!: QuotationLineDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => QuotationSectionDto)
  sections?: QuotationSectionDto[];
}
