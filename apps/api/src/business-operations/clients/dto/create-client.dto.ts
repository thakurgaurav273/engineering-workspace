import { ClientType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateClientDto {
  @IsString() @MaxLength(200) name!: string;

  @IsOptional() @IsEnum(ClientType) type?: ClientType;
  @IsOptional() @IsString() @MaxLength(200) companyName?: string;
  @IsOptional() @IsString() @MaxLength(200) contactPersonName?: string;
  @IsOptional() @IsEmail() @MaxLength(200) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) website?: string;

  @IsOptional() @IsString() @MaxLength(20) gstin?: string;
  @IsOptional() @IsString() @MaxLength(20) pan?: string;
  @IsOptional() @IsString() @MaxLength(40) taxId?: string;

  @IsOptional() @IsString() @MaxLength(200) billingLine1?: string;
  @IsOptional() @IsString() @MaxLength(200) billingLine2?: string;
  @IsOptional() @IsString() @MaxLength(120) billingCity?: string;
  @IsOptional() @IsString() @MaxLength(120) billingState?: string;
  @IsOptional() @IsString() @MaxLength(20) billingPostalCode?: string;
  @IsOptional() @IsString() @MaxLength(120) billingCountry?: string;

  @IsOptional() @IsString() @MaxLength(200) shippingLine1?: string;
  @IsOptional() @IsString() @MaxLength(200) shippingLine2?: string;
  @IsOptional() @IsString() @MaxLength(120) shippingCity?: string;
  @IsOptional() @IsString() @MaxLength(120) shippingState?: string;
  @IsOptional() @IsString() @MaxLength(20) shippingPostalCode?: string;
  @IsOptional() @IsString() @MaxLength(120) shippingCountry?: string;

  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}
