export interface PresignedUpload {
  /**
   * How the browser sends the file: `PUT` the raw bytes to `uploadUrl` with `headers`
   * (R2 presigned URL), or `POST` a multipart form of `fields` plus the file as `file`
   * (Cloudinary signed upload).
   */
  method: 'PUT' | 'POST';
  /** Short-lived upload endpoint the browser sends the file to. */
  uploadUrl: string;
  /** Final public URL the object is served from once uploaded. */
  publicUrl: string;
  /** The object key inside the store. */
  key: string;
  /** Headers the client MUST send on a PUT so the signature matches. */
  headers: Record<string, string>;
  /** Form fields the client MUST send on a POST so the signature matches. */
  fields: Record<string, string>;
  /** Seconds until the upload authorization expires. */
  expiresIn: number;
}

export interface UploadRequest {
  key: string;
  contentType: string;
  contentLength: number;
  expiresIn?: number;
}

/**
 * A storage backend behind StorageService. Each one is only constructed when its
 * credentials are complete (see the static `fromEnv` factories).
 */
export interface StorageProvider {
  readonly name: 'r2' | 'cloudinary';
  presignUpload(params: UploadRequest): Promise<PresignedUpload>;
  /** Full public URL for a stored object key. */
  publicUrl(key: string): string;
  /** The object key if `url` is one of this backend's public URLs, else null. */
  keyFromPublicUrl(url: string): string | null;
  /** Best-effort delete by key. Never throws. */
  deleteObject(key: string): Promise<void>;
}
