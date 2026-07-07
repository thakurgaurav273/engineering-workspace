import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, Max, Min } from 'class-validator';

/** Content types accepted for signatures. PNG (transparent) is the usual choice. */
export const SIGNATURE_ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const SIGNATURE_MAX_BYTES = 2 * 1024 * 1024; // 2MB — a signature is a small image

/** MIME -> file extension. Derived here, never from the client filename. */
export const SIGNATURE_MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export class SignatureUploadUrlDto {
  @ApiProperty({ enum: SIGNATURE_ALLOWED_MIME })
  @IsIn(SIGNATURE_ALLOWED_MIME as unknown as string[])
  contentType: string;

  @ApiProperty({ minimum: 1, maximum: SIGNATURE_MAX_BYTES, description: 'File size in bytes' })
  @IsInt()
  @Min(1)
  @Max(SIGNATURE_MAX_BYTES)
  size: number;
}
