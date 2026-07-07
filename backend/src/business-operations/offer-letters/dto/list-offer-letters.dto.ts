import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { EmploymentType, OfferLetterStatus } from '@prisma/client';

const EMPLOYMENT: EmploymentType[] = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'];

export class ListOfferLettersDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED'])
  status?: OfferLetterStatus;
  @IsOptional() @IsIn(EMPLOYMENT) employmentType?: EmploymentType;
  @IsOptional() @IsIn(['createdAt', 'offerDate', 'candidateName']) sort?: 'createdAt' | 'offerDate' | 'candidateName';
  @IsOptional() @IsIn(['asc', 'desc']) order?: 'asc' | 'desc';
}
