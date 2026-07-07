import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class TaxSelectionDto {
  @IsIn(['NONE', 'GST', 'CGST', 'SGST', 'IGST', 'VAT', 'CUSTOM'])
  type!: 'NONE' | 'GST' | 'CGST' | 'SGST' | 'IGST' | 'VAT' | 'CUSTOM';

  @IsOptional() @IsNumber() @Min(0) rate?: number;
  @IsOptional() @IsNumber() @Min(0) amount?: number;
  @IsOptional() @IsIn(['PERCENT', 'FIXED']) mode?: 'PERCENT' | 'FIXED';
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsBoolean() reverseCharge?: boolean;
}

export class TaxLineDto {
  @IsOptional() @IsString() description?: string;
  @IsNumber() @Min(0) quantity!: number;
  @IsNumber() @Min(0) price!: number;
  @IsOptional() @IsNumber() @Min(0) discount?: number;
  @IsOptional() @IsIn(['PERCENT', 'FIXED']) discountType?: 'PERCENT' | 'FIXED';
  @IsOptional() @IsBoolean() exempt?: boolean;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => TaxSelectionDto)
  taxes?: TaxSelectionDto[];
}

export class CalculateTaxDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => TaxLineDto)
  items!: TaxLineDto[];

  @IsOptional() @IsString() companyState?: string;
  @IsOptional() @IsString() customerState?: string;
  @IsOptional() @IsString() customerCountry?: string;
  @IsOptional() @IsBoolean() customerHasGstin?: boolean;
  @IsOptional() @IsIn(['EXCLUSIVE', 'INCLUSIVE']) priceMode?: 'EXCLUSIVE' | 'INCLUSIVE';
  @IsOptional() @IsIn(['NONE', 'NEAREST', 'UP', 'DOWN']) roundingMode?: 'NONE' | 'NEAREST' | 'UP' | 'DOWN';
}
