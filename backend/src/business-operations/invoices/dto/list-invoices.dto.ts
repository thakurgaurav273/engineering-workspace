import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { InvoiceStatus } from '@prisma/client';

export class ListInvoicesDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(['DRAFT', 'ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'VOID'])
  status?: InvoiceStatus;
  @IsOptional() @IsString() clientId?: string;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional() @IsIn(['createdAt', 'issueDate', 'grandTotal']) sort?: 'createdAt' | 'issueDate' | 'grandTotal';
  @IsOptional() @IsIn(['asc', 'desc']) order?: 'asc' | 'desc';
}
