import { TaskUpdateAttachmentKind } from '@prisma/client';
import { StorageService } from '@/platform/storage/storage.service';
import { AttachmentInputDto } from './dto/attachment-input.dto';

export interface AttachmentCreateData {
  kind: TaskUpdateAttachmentKind;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Maps validated attachment inputs to Prisma nested-create rows, dropping any whose URL is
 * not one of our own storage objects (defence against a client persisting an arbitrary
 * external URL as an "attachment"). Images-only for now - kind is always `image`.
 */
export function mapImageAttachments(
  attachments: AttachmentInputDto[] | undefined,
  storage: StorageService,
): AttachmentCreateData[] {
  if (!attachments?.length) return [];
  return attachments
    .filter((a) => storage.keyFromPublicUrl(a.url) !== null)
    .map((a) => ({
      kind: TaskUpdateAttachmentKind.image,
      url: a.url,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
    }));
}
