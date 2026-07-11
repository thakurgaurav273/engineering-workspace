import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateInvitationDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  // Name is collected when the invite is accepted, not when it's sent - an
  // existing account already has one, and a brand-new account sets its own.
  @ApiPropertyOptional({ enum: Role, default: Role.MEMBER })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
