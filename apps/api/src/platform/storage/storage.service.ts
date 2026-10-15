import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { PresignedUpload, StorageProvider } from './providers/storage-provider';
import { R2StorageProvider } from './providers/r2.provider';
import { CloudinaryStorageProvider } from './providers/cloudinary.provider';

export type { PresignedUpload } from './providers/storage-provider';

/**
 * Generic object storage, backed by Cloudflare R2 or Cloudinary.
 *
 * Deliberately domain-agnostic: it knows about keys, content types and sizes,
 * not about avatars. Compose it from feature services (avatars today; task-update
 * attachments, recognition images, workspace files later) by building your own
 * key prefix and passing it to {@link presignUpload}.
 *
 * Uploads never pass through the API: the browser sends the file directly to the
 * store with a short-lived authorization issued here (see {@link PresignedUpload}).
 *
 * The backend for new uploads is STORAGE_PROVIDER ("r2" | "cloudinary"); when unset,
 * the first fully-configured one wins, R2 first.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  /**
   * Every backend with complete credentials. URL ownership and cleanup check all of
   * them, so assets uploaded before a provider switch are still recognized as ours.
   */
  private readonly providers: StorageProvider[];
  /** Where new uploads go. */
  private readonly active: StorageProvider | null;

  constructor() {
    const candidates: (StorageProvider | null)[] = [
      R2StorageProvider.fromEnv(),
      CloudinaryStorageProvider.fromEnv(),
    ];
    this.providers = candidates.filter((p): p is StorageProvider => p !== null);
    const wanted = (process.env.STORAGE_PROVIDER ?? '').trim().toLowerCase();
    this.active = wanted
      ? (this.providers.find((p) => p.name === wanted) ?? null)
      : (this.providers[0] ?? null);

    if (this.active) {
      this.logger.log(`File storage: ${this.active.name}`);
    } else if (wanted) {
      this.logger.warn(
        `STORAGE_PROVIDER="${wanted}" is not fully configured - direct uploads are disabled.`,
      );
    } else {
      this.logger.warn(
        'File storage is not configured (set the R2_* or CLOUDINARY_* env vars) - direct uploads are disabled.',
      );
    }
  }

  isConfigured(): boolean {
    return this.active !== null;
  }

  /** The backend new uploads go to ("r2" | "cloudinary"), or null when uploads are disabled. */
  providerName(): StorageProvider['name'] | null {
    return this.active?.name ?? null;
  }

  /** Full public URL for a stored object key. */
  publicUrl(key: string): string {
    return this.active?.publicUrl(key) ?? '';
  }

  /**
   * Returns the object key if `url` is one of our own public URLs, else null.
   * Used to decide whether a previously-stored asset belongs to us before
   * deleting it (never touch externally-hosted URLs).
   */
  keyFromPublicUrl(url?: string | null): string | null {
    return url ? (this.ownerOf(url)?.key ?? null) : null;
  }

  /**
   * Builds a collision-free object key under `prefix`. The client filename is
   * never trusted - a fresh UUID is always generated. `ext` should come from a
   * validated content type, not from the upload's name.
   */
  buildKey(prefix: string, ext: string): string {
    const clean = prefix.replace(/^\/+|\/+$/g, '');
    return `${clean}/${randomUUID()}.${ext}`;
  }

  /**
   * Authorizes one direct browser upload of `key`. The authorization pins the key and
   * content type (and, on R2, the exact byte size), so the store rejects anything else.
   */
  async presignUpload(params: {
    key: string;
    contentType: string;
    contentLength: number;
    expiresIn?: number;
  }): Promise<PresignedUpload> {
    if (!this.active) {
      throw new InternalServerErrorException('File storage is not configured.');
    }
    return this.active.presignUpload(params);
  }

  /** Best-effort delete by key. Never throws - a failed cleanup must not fail the request. */
  async deleteObject(key: string): Promise<void> {
    await this.active?.deleteObject(key);
  }

  /** Best-effort delete of an asset given its public URL, if it belongs to one of our stores. */
  async deleteByPublicUrl(url?: string | null): Promise<void> {
    const owner = url ? this.ownerOf(url) : null;
    if (owner) await owner.provider.deleteObject(owner.key);
  }

  private ownerOf(url: string): { provider: StorageProvider; key: string } | null {
    for (const provider of this.providers) {
      const key = provider.keyFromPublicUrl(url);
      if (key) return { provider, key };
    }
    return null;
  }
}
