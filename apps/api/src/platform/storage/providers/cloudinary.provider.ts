import { Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import type { PresignedUpload, StorageProvider, UploadRequest } from './storage-provider';

type ResourceType = 'image' | 'video' | 'raw';

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg', 'bmp', 'tiff', 'ico']);
const VIDEO_EXTS = new Set(['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v']);

/**
 * Cloudinary. The browser POSTs the file straight to Cloudinary's upload API with a
 * signature issued here, so bytes never pass through the API and no bucket CORS or
 * custom domain is needed. The signature pins the public_id (our key) and the stored
 * format, so a client can't choose where the asset lands or what it is saved as.
 *
 * Unlike R2, Cloudinary can't pin the byte size - the account's upload limit is the
 * cap - and a signed timestamp stays valid for one hour.
 */
export class CloudinaryStorageProvider implements StorageProvider {
  readonly name = 'cloudinary';
  private readonly logger = new Logger(CloudinaryStorageProvider.name);
  private readonly deliveryBase: string;
  private readonly apiBase: string;

  private constructor(
    cloudName: string,
    private readonly apiKey: string,
    private readonly apiSecret: string,
  ) {
    this.deliveryBase = `https://res.cloudinary.com/${cloudName}/`;
    this.apiBase = `https://api.cloudinary.com/v1_1/${cloudName}`;
  }

  /**
   * Null unless credentials are complete. Accepts the three CLOUDINARY_* vars or
   * CLOUDINARY_URL (cloudinary://<api_key>:<api_secret>@<cloud_name>, as shown in the
   * Cloudinary console); the separate vars win when both are set.
   */
  static fromEnv(): CloudinaryStorageProvider | null {
    let fromUrl: { cloud?: string; key?: string; secret?: string } = {};
    if (process.env.CLOUDINARY_URL) {
      try {
        const u = new URL(process.env.CLOUDINARY_URL);
        fromUrl = {
          cloud: u.hostname,
          key: decodeURIComponent(u.username),
          secret: decodeURIComponent(u.password),
        };
      } catch {
        // Malformed - fall back to the separate vars.
      }
    }
    const cloud = process.env.CLOUDINARY_CLOUD_NAME || fromUrl.cloud;
    const key = process.env.CLOUDINARY_API_KEY || fromUrl.key;
    const secret = process.env.CLOUDINARY_API_SECRET || fromUrl.secret;
    return cloud && key && secret ? new CloudinaryStorageProvider(cloud, key, secret) : null;
  }

  /**
   * Splits a key like `avatars/<id>/<uuid>.png` into Cloudinary terms. Images and videos
   * carry their extension as the format, not in the public_id; raw files keep it.
   */
  private parseKey(key: string): { ext: string; resourceType: ResourceType; publicId: string } {
    const dot = key.lastIndexOf('.');
    const ext = dot > key.lastIndexOf('/') ? key.slice(dot + 1).toLowerCase() : '';
    const resourceType: ResourceType = IMAGE_EXTS.has(ext)
      ? 'image'
      : VIDEO_EXTS.has(ext)
        ? 'video'
        : 'raw';
    const publicId = resourceType === 'raw' ? key : key.slice(0, dot);
    return { ext, resourceType, publicId };
  }

  /** Cloudinary request signature: SHA-1 of the params sorted by name as `k=v&...`, then the API secret. */
  private sign(params: Record<string, string>): string {
    const payload = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');
    return createHash('sha1').update(payload + this.apiSecret).digest('hex');
  }

  private timestamp(): string {
    return String(Math.floor(Date.now() / 1000));
  }

  publicUrl(key: string): string {
    return `${this.deliveryBase}${this.parseKey(key).resourceType}/upload/${key}`;
  }

  keyFromPublicUrl(url: string): string | null {
    if (!url.startsWith(this.deliveryBase)) return null;
    // <resource_type>/upload/[v<version>/]<key>
    const match = /^(?:image|video|raw)\/upload\/(?:v\d+\/)?(.+)$/.exec(
      url.slice(this.deliveryBase.length),
    );
    return match ? match[1] : null;
  }

  async presignUpload(params: UploadRequest): Promise<PresignedUpload> {
    const { ext, resourceType, publicId } = this.parseKey(params.key);
    const signed: Record<string, string> = {
      public_id: publicId,
      timestamp: this.timestamp(),
      // Store the type the API validated, whatever the client actually sends.
      ...(resourceType !== 'raw' ? { format: ext } : {}),
    };
    return {
      method: 'POST',
      uploadUrl: `${this.apiBase}/${resourceType}/upload`,
      publicUrl: this.publicUrl(params.key),
      key: params.key,
      headers: {},
      fields: { ...signed, api_key: this.apiKey, signature: this.sign(signed) },
      expiresIn: 3600,
    };
  }

  async deleteObject(key: string): Promise<void> {
    const { resourceType, publicId } = this.parseKey(key);
    const signed = { public_id: publicId, timestamp: this.timestamp() };
    try {
      const res = await fetch(`${this.apiBase}/${resourceType}/destroy`, {
        method: 'POST',
        body: new URLSearchParams({ ...signed, api_key: this.apiKey, signature: this.sign(signed) }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        result?: string;
        error?: { message?: string };
      };
      // "not found" means it's already gone - nothing to clean up.
      if (data.result !== 'ok' && data.result !== 'not found') {
        throw new Error(data.error?.message ?? data.result ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      this.logger.warn(
        `Failed to delete Cloudinary asset "${publicId}": ${(err as Error).message}`,
      );
    }
  }
}
