import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ProposalStatus } from '@prisma/client';

export class ListProposalsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(['DRAFT', 'SENT', 'VIEWED', 'APPROVED', 'REJECTED', 'ARCHIVED'])
  status?: ProposalStatus;
  @IsOptional() @IsString() clientId?: string;
  @IsOptional() @IsIn(['createdAt', 'title', 'validUntil']) sort?: 'createdAt' | 'title' | 'validUntil';
  @IsOptional() @IsIn(['asc', 'desc']) order?: 'asc' | 'desc';
}
