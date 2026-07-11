import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TaxSelectionDto } from '../../tax/dto/calculate-tax.dto';

export class InvoiceLineDto {
  @IsString() @MaxLength(500) description!: string;
  @IsOptional() @IsNumber() @Min(0) quantity?: number;
  @IsOptional() @IsString() @MaxLength(20) unit?: string;
  @IsNumber() @Min(0) unitPrice!: number;
  @IsOptional() @IsNumber() @Min(0) discount?: number;
  @IsOptional() @IsIn(['PERCENT', 'FIXED']) discountType?: 'PERCENT' | 'FIXED';
  @IsOptional() @IsString() @MaxLength(500) notes?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => TaxSelectionDto)
  taxes?: TaxSelectionDto[];
}

export class InvoiceSectionDto {
  @IsString() @MaxLength(300) title!: string;
  // Plain rich-text HTML. No markdown renderer yet; stored verbatim.
  @IsOptional() @IsString() @MaxLength(100000) content?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) order?: number;
}

export const INVOICE_TYPES = [
  'STANDARD',
  'PROFORMA',
  'TAX',
  'CREDIT_NOTE',
  'DEBIT_NOTE',
  'RECURRING',
  'ADVANCE',
  'FINAL_SETTLEMENT',
] as const;
export type InvoiceTypeValue = (typeof INVOICE_TYPES)[number];

export class CreateInvoiceDto {
  @IsOptional() @IsString() clientId?: string;
  @IsOptional() @IsString() @MaxLength(200) clientName?: string;
  @IsOptional() @IsIn(INVOICE_TYPES) invoiceType?: InvoiceTypeValue;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
  @IsOptional() @IsString() @MaxLength(4000) terms?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsIn(['EXCLUSIVE', 'INCLUSIVE']) priceMode?: string;

  @IsArray() @ValidateNested({ each: true }) @Type(() => InvoiceLineDto)
  lines!: InvoiceLineDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => InvoiceSectionDto)
  sections?: InvoiceSectionDto[];
}
