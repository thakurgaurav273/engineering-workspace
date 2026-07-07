import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Full company profile payload (used for upsert). Only `legalName` is required. */
export class UpdateCompanyProfileDto {
  @IsString()
  @MaxLength(200)
  legalName!: string;

  @IsOptional() @IsString() @MaxLength(200) displayName?: string;
  @IsOptional() @IsString() @MaxLength(1024) logoUrl?: string;

  @IsOptional() @IsString() @MaxLength(200) addressLine1?: string;
  @IsOptional() @IsString() @MaxLength(200) addressLine2?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(120) state?: string;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(120) country?: string;

  @IsOptional() @IsString() @MaxLength(20) gstin?: string;
  @IsOptional() @IsString() @MaxLength(20) pan?: string;
  @IsOptional() @IsString() @MaxLength(30) cin?: string;

  @IsOptional() @IsString() @MaxLength(200) bankName?: string;
  @IsOptional() @IsString() @MaxLength(200) bankAccountName?: string;
  @IsOptional() @IsString() @MaxLength(50) bankAccountNumber?: string;
  @IsOptional() @IsString() @MaxLength(20) bankIfsc?: string;
  @IsOptional() @IsString() @MaxLength(100) upiId?: string;

  @IsOptional() @IsEmail() @MaxLength(200) contactEmail?: string;
  @IsOptional() @IsString() @MaxLength(40) contactPhone?: string;
  @IsOptional() @IsString() @MaxLength(200) website?: string;

  @IsOptional() @IsString() @MaxLength(2000) invoiceFooterNotes?: string;
  @IsOptional() @IsString() @MaxLength(200) authorizedSignatoryName?: string;
  @IsOptional() @IsString() @MaxLength(200) authorizedSignatoryDesignation?: string;
}
