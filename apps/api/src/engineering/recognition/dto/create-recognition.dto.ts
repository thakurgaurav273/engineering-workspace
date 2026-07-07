import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRecognitionDto {
  @ApiProperty({ description: 'ID of the user to recognize' })
  @IsString()
  recipientId: string;

  @ApiProperty({ example: 'Outstanding debugging skills' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'Resolved a critical production issue in record time' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
