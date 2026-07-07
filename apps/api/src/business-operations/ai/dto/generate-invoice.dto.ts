import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class GenerateInvoiceDto {
  @IsString() clientId!: string;

  /** Natural-language description of the work to invoice. */
  @IsString() @MinLength(3) @MaxLength(4000) prompt!: string;

  /**
   * When true (default) the parsed draft is persisted as a DRAFT invoice and returned.
   * When false only the parsed draft is returned, for the client to review before saving.
   */
  @IsOptional() @IsBoolean() persist?: boolean;
}
