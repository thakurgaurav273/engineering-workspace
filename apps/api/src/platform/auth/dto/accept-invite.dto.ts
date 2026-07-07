import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class AcceptInviteDto {
  @ApiProperty()
  @IsString()
  token: string;

  // For a brand-new account this is the password being set; for an email that already
  // has an account, this is that account's *existing* password, used to prove ownership
  // before the pending membership is activated. Either way, required — validated in
  // InvitationsService.accept() since the min length only applies to the new-account case.
  @ApiProperty()
  @IsString()
  password: string;

  // Only required (and only used) when the invited email doesn't have an account yet.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;
}
