import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

const METHODS: PaymentMethod[] = ['BANK_TRANSFER', 'UPI', 'CARD', 'CASH', 'CHEQUE', 'STRIPE', 'RAZORPAY', 'OTHER'];

export class ListPaymentsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() invoiceId?: string;
  @IsOptional() @IsString() clientId?: string;
  @IsOptional() @IsIn(METHODS) method?: PaymentMethod;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional() @IsIn(['paymentDate', 'amount', 'createdAt']) sort?: 'paymentDate' | 'amount' | 'createdAt';
  @IsOptional() @IsIn(['asc', 'desc']) order?: 'asc' | 'desc';
}
