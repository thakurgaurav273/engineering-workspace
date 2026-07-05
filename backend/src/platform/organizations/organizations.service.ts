import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { StorageService } from '@/platform/storage/storage.service';
import { AVATAR_MIME_EXT, AvatarUploadUrlDto } from '@/platform/users/dto/avatar-upload.dto';
import { UpdateOrganizationDto } from './dto/create-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async findMine(orgId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(orgId: string, dto: UpdateOrganizationDto) {
    const previous = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { logoUrl: true },
    });

    const org = await this.prisma.organization.update({ where: { id: orgId }, data: dto });

    // Reclaim the replaced logo so old objects don't accumulate in the bucket.
    // Best-effort and scoped to our own bucket (external URLs are left untouched).
    if (dto.logoUrl && previous?.logoUrl && previous.logoUrl !== dto.logoUrl) {
      await this.storage.deleteByPublicUrl(previous.logoUrl);
    }

    return org;
  }

  /**
   * Issues a short-lived presigned PUT URL so the browser can upload a new org logo
   * directly to R2 (the file never passes through this API). Mirrors the user-avatar
   * flow: MIME type and size are validated + pinned into the signature, and the object
   * key is generated as org-logos/{orgId}/{uuid}.{ext} - the client filename is never trusted.
   */
  async createLogoUploadUrl(orgId: string, dto: AvatarUploadUrlDto) {
    if (!this.storage.isConfigured()) {
      throw new BadRequestException('File uploads are not available right now');
    }
    await this.findMine(orgId);

    const ext = AVATAR_MIME_EXT[dto.contentType];
    if (!ext) throw new BadRequestException('Unsupported image type');

    const key = this.storage.buildKey(`org-logos/${orgId}`, ext);
    return this.storage.presignUpload({
      key,
      contentType: dto.contentType,
      contentLength: dto.size,
    });
  }
}
