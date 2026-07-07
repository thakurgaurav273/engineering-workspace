import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SwitchOrgDto {
  @ApiProperty({ description: 'Organization to switch into' })
  @IsString()
  orgId: string;

  @ApiProperty({ description: "The device's current refresh token, so its session can be rotated in place" })
  @IsString()
  refreshToken: string;
}
