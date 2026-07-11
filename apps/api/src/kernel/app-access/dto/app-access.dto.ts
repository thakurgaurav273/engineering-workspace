import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class SetAppAccessDto {
  /** Organization to scope the grant to. Defaults to the caller's current organization. */
  @IsOptional()
  @IsString()
  orgId?: string;

  @IsString()
  userId!: string;

  @IsString()
  applicationKey!: string;

  @IsBoolean()
  granted!: boolean;
}

export class AccessMatrixQueryDto {
  @IsOptional()
  @IsString()
  orgId?: string;
}
