import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, Max, Min } from 'class-validator';

/**
 * Shared image constraints for comment/task-update attachments. Broader than avatars
 * (adds gif, larger cap) but still images-only. Mirrored client-side in
 * src/lib/uploads.ts and re-validated + signature-pinned server-side.
 */
export const COMMENT_IMAGE_ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;
export const COMMENT_IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10MB

/** MIME -> file extension. The extension is derived here, never from the client filename. */
export const COMMENT_IMAGE_MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export class ImageUploadUrlDto {
  @ApiProperty({ enum: COMMENT_IMAGE_ALLOWED_MIME })
  @IsIn(COMMENT_IMAGE_ALLOWED_MIME as unknown as string[])
  contentType: string;

  @ApiProperty({ minimum: 1, maximum: COMMENT_IMAGE_MAX_BYTES, description: 'File size in bytes' })
  @IsInt()
  @Min(1)
  @Max(COMMENT_IMAGE_MAX_BYTES)
  size: number;
}
