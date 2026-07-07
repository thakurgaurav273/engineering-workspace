import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateDocumentNumberingDto {
  @IsOptional() @IsString() @MaxLength(20) prefix?: string;
  @IsOptional() @IsString() @MaxLength(20) suffix?: string;
  @IsOptional() @IsString() @MaxLength(3) separator?: string;
  @IsOptional() @IsInt() @Min(1) startNumber?: number;
  @IsOptional() @IsInt() @Min(0) currentNumber?: number;
  @IsOptional() @IsInt() @Min(1) @Max(12) padding?: number;
  @IsOptional() @IsIn(['NEVER', 'YEARLY', 'MONTHLY']) resetMode?: 'NEVER' | 'YEARLY' | 'MONTHLY';
  @IsOptional() @IsBoolean() useFinancialYear?: boolean;
}
