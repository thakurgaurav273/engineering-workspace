import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateTaxConfigDto {
  @IsOptional() @IsString() @MaxLength(20) regime?: string;
  @IsOptional() @IsString() @MaxLength(60) homeCountry?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) defaultGstRate?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) defaultVatRate?: number;
  @IsOptional() @IsIn(['EXCLUSIVE', 'INCLUSIVE']) priceMode?: 'EXCLUSIVE' | 'INCLUSIVE';
  @IsOptional() @IsIn(['NONE', 'NEAREST', 'UP', 'DOWN']) roundingMode?: 'NONE' | 'NEAREST' | 'UP' | 'DOWN';
}
