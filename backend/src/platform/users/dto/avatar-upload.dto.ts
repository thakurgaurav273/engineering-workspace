import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, Max, Min } from 'class-validator';

/** Content types accepted for avatars. jpg and jpeg share the image/jpeg type. */
export const AVATAR_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5MB

/** MIME -> file extension. The extension is derived here, never from the client filename. */
export const AVATAR_MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export class AvatarUploadUrlDto {
  @ApiProperty({ enum: AVATAR_ALLOWED_MIME })
  @IsIn(AVATAR_ALLOWED_MIME as unknown as string[])
  contentType: string;

  @ApiProperty({ minimum: 1, maximum: AVATAR_MAX_BYTES, description: 'File size in bytes' })
  @IsInt()
  @Min(1)
  @Max(AVATAR_MAX_BYTES)
  size: number;
}
