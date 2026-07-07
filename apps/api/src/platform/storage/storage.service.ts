import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

export interface PresignedUpload {
  /** Short-lived presigned PUT URL the browser uploads the raw bytes to. */
  uploadUrl: string;
  /** Final public URL the object is served from once uploaded. */
  publicUrl: string;
  /** The object key inside the bucket. */
  key: string;
  /** Headers the client MUST send on the PUT so the signature matches. */
  headers: Record<string, string>;
  /** Seconds until the presigned URL expires. */
  expiresIn: number;
}

/**
 * Generic Cloudflare R2 (S3-compatible) object storage.
 *
 * Deliberately domain-agnostic: it knows about keys, content types and sizes,
 * not about avatars. Compose it from feature services (avatars today; task-update
 * attachments, recognition images, workspace files later) by building your own
 * key prefix and passing it to {@link presignUpload}.
 *
 * Uploads never pass through the API: the browser PUTs directly to R2 using a
 * short-lived presigned URL. The signature pins ContentType and ContentLength,
 * so a client cannot upload a different type or a larger file than was authorized.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket = process.env.R2_BUCKET ?? '';
  private readonly publicBase = (process.env.R2_PUBLIC_URL ?? '').replace(/\/+$/, '');

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (accountId && accessKeyId && secretAccessKey && this.bucket && this.publicBase) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
        // R2 does not support the CRC32 integrity checksum the AWS SDK v3 now adds by
        // default (requestChecksumCalculation: "WHEN_SUPPORTED"). It gets baked into the
        // presigned signature, but the browser's raw PUT never sends the header, so R2
        // rejects the upload with 400. Only sign checksums when a command explicitly asks.
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      });
    } else {
      this.client = null;
      this.logger.warn(
        'R2 storage is not configured (missing R2_* env vars) - direct uploads are disabled.',
      );
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  /** Full public URL for a stored object key. */
  publicUrl(key: string): string {
    return `${this.publicBase}/${key}`;
  }

  /**
   * Returns the object key if `url` is one of our own public URLs, else null.
   * Used to decide whether a previously-stored asset belongs to our bucket
   * before deleting it (never touch externally-hosted URLs).
   */
  keyFromPublicUrl(url?: string | null): string | null {
    if (!url || !this.publicBase) return null;
    const prefix = `${this.publicBase}/`;
    return url.startsWith(prefix) ? url.slice(prefix.length) : null;
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
   * Generates a presigned PUT URL. The signed command pins ContentType and
   * ContentLength, so R2 rejects any PUT whose type/size differs from what was
   * authorized here.
   */
  async presignUpload(params: {
    key: string;
    contentType: string;
    contentLength: number;
    expiresIn?: number;
  }): Promise<PresignedUpload> {
    if (!this.client) {
      throw new InternalServerErrorException('File storage is not configured.');
    }
    const expiresIn = params.expiresIn ?? 300;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      ContentType: params.contentType,
      ContentLength: params.contentLength,
    });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });
    return {
      uploadUrl,
      publicUrl: this.publicUrl(params.key),
      key: params.key,
      headers: { 'Content-Type': params.contentType },
      expiresIn,
    };
  }

  /** Best-effort delete by key. Never throws - a failed cleanup must not fail the request. */
  async deleteObject(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err) {
      this.logger.warn(
        `Failed to delete R2 object "${key}": ${(err as Error).message}`,
      );
    }
  }

  /** Best-effort delete of an asset given its public URL, if it belongs to our bucket. */
  async deleteByPublicUrl(url?: string | null): Promise<void> {
    const key = this.keyFromPublicUrl(url);
    if (key) await this.deleteObject(key);
  }
}
