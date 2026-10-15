import { Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { PresignedUpload, StorageProvider, UploadRequest } from './storage-provider';

/**
 * Cloudflare R2 (S3-compatible). The browser PUTs directly to R2 using a short-lived
 * presigned URL. The signature pins ContentType and ContentLength, so a client cannot
 * upload a different type or a larger file than was authorized.
 *
 * R2_PUBLIC_URL is wherever the bucket is publicly served from: a custom domain on a
 * Cloudflare-managed zone, or the bucket's r2.dev public development URL.
 */
export class R2StorageProvider implements StorageProvider {
  readonly name = 'r2';
  private readonly logger = new Logger(R2StorageProvider.name);
  private readonly client: S3Client;

  private constructor(
    accountId: string,
    accessKeyId: string,
    secretAccessKey: string,
    private readonly bucket: string,
    private readonly publicBase: string,
  ) {
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
  }

  /** Null unless all five R2_* vars are set. */
  static fromEnv(): R2StorageProvider | null {
    const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
    const publicBase = (process.env.R2_PUBLIC_URL ?? '').replace(/\/+$/, '');
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !publicBase) {
      return null;
    }
    return new R2StorageProvider(R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, publicBase);
  }

  publicUrl(key: string): string {
    return `${this.publicBase}/${key}`;
  }

  keyFromPublicUrl(url: string): string | null {
    const prefix = `${this.publicBase}/`;
    return url.startsWith(prefix) ? url.slice(prefix.length) : null;
  }

  async presignUpload(params: UploadRequest): Promise<PresignedUpload> {
    const expiresIn = params.expiresIn ?? 300;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      ContentType: params.contentType,
      ContentLength: params.contentLength,
    });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });
    return {
      method: 'PUT',
      uploadUrl,
      publicUrl: this.publicUrl(params.key),
      key: params.key,
      headers: { 'Content-Type': params.contentType },
      fields: {},
      expiresIn,
    };
  }

  async deleteObject(key: string): Promise<void> {
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
}
