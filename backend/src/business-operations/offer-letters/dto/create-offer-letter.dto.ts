import { Type } from 'class-transformer';
import { IsDateString, IsEmail, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { EmploymentType } from '@prisma/client';

const EMPLOYMENT: EmploymentType[] = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'];

export class CreateOfferLetterDto {
  @IsString() @MaxLength(200) candidateName!: string;
  @IsEmail() candidateEmail!: string;
  @IsOptional() @IsString() @MaxLength(40) candidatePhone?: string;
  @IsOptional() @IsString() @MaxLength(500) candidateAddress?: string;

  @IsString() @MaxLength(200) position!: string;
  @IsOptional() @IsString() @MaxLength(200) department?: string;
  @IsOptional() @IsString() @MaxLength(200) designation?: string;
  @IsOptional() @IsString() @MaxLength(200) reportingManager?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsIn(EMPLOYMENT) employmentType?: EmploymentType;
  @IsOptional() @IsString() @MaxLength(200) workLocation?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) baseSalary?: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) variablePay?: number;
  @IsOptional() @IsString() @MaxLength(2000) salaryBreakdown?: string;
  @IsOptional() @IsString() @MaxLength(2000) benefits?: string;

  @IsOptional() @IsString() @MaxLength(200) noticePeriod?: string;
  @IsOptional() @IsString() @MaxLength(200) probationPeriod?: string;
  @IsOptional() @IsString() @MaxLength(8000) termsAndConditions?: string;
  @IsOptional() @IsString() @MaxLength(4000) additionalNotes?: string;

  @IsOptional() @IsDateString() offerDate?: string;
  @IsOptional() @IsDateString() validUntil?: string;
}
