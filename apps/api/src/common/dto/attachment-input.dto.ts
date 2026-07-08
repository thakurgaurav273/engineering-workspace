import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';
import { COMMENT_IMAGE_MAX_BYTES } from '@/platform/storage/dto/image-upload.dto';

/**
 * One already-uploaded attachment, referenced by its final R2 public URL. The bytes are
 * uploaded directly to R2 via a presigned PUT (see StorageService) BEFORE the comment/update
 * is submitted; this DTO only carries the resulting metadata. Services additionally verify
 * the url belongs to our bucket (StorageService.keyFromPublicUrl) before persisting.
 */
export class AttachmentInputDto {
  @ApiProperty({ description: 'Public URL of the uploaded object (must be from our storage bucket)' })
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  url: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  fileName: string;

  @ApiProperty()
  @IsString()
  @MaxLength(128)
  mimeType: string;

  @ApiProperty({ minimum: 1, maximum: COMMENT_IMAGE_MAX_BYTES })
  @IsInt()
  @Min(1)
  @Max(COMMENT_IMAGE_MAX_BYTES)
  sizeBytes: number;
}
