import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ConnectLinearDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  apiKey: string;
}
