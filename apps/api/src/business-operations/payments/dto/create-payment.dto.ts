import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

const METHODS: PaymentMethod[] = ['BANK_TRANSFER', 'UPI', 'CARD', 'CASH', 'CHEQUE', 'STRIPE', 'RAZORPAY', 'OTHER'];

export class CreatePaymentDto {
  @IsString() invoiceId!: string;
  @Type(() => Number) @IsNumber() @Min(0.01) amount!: number;
  @IsDateString() paymentDate!: string;
  @IsOptional() @IsIn(METHODS) method?: PaymentMethod;
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}
