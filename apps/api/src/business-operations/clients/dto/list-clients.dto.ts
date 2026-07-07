import { ClientType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBooleanString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListClientsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;

  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(ClientType) type?: ClientType;

  /** Show archived clients instead of active ones. */
  @IsOptional() @IsBooleanString() archived?: string;
  /** Filter by active/inactive flag. */
  @IsOptional() @IsBooleanString() active?: string;

  @IsOptional() @IsIn(['name', 'createdAt', 'updatedAt']) sort?: 'name' | 'createdAt' | 'updatedAt';
  @IsOptional() @IsIn(['asc', 'desc']) order?: 'asc' | 'desc';
}
