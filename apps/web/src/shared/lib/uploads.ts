import { api } from "./api";

// Mirror of the backend's avatar constraints (backend/.../dto/avatar-upload.dto.ts).
// Validated here for instant feedback AND re-validated + signature-pinned server-side.
export const AVATAR_ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5MB
export const AVATAR_ACCEPT = AVATAR_ALLOWED_MIME.join(","); // for <input accept>

interface PresignedUpload {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  headers: Record<string, string>;
  expiresIn: number;
}

/** Returns an error message if the file is not an acceptable image, else null. */
export function validateImageFile(
  file: File,
  { maxBytes = AVATAR_MAX_BYTES, allowed = AVATAR_ALLOWED_MIME as readonly string[] } = {},
): string | null {
  if (!allowed.includes(file.type)) return "Please choose a JPG, PNG, or WebP image.";
  if (file.size > maxBytes) {
    return `Image must be ${Math.round(maxBytes / 1024 / 1024)}MB or smaller.`;
  }
  return null;
}

/** Raw PUT to R2 with upload-progress reporting and abort support. */
function putWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    // Content-Type must match what the presigned URL was signed with.
    for (const [k, v] of Object.entries(headers ?? {})) xhr.setRequestHeader(k, v);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }
    xhr.send(file);
  });
}

/**
 * Shared image-upload flow: validate, ask the API (`uploadUrlPath`) for a presigned R2
 * PUT URL, then upload the bytes directly to R2 (never through the API). Returns the
 * final public URL, which the caller persists.
 */
async function uploadImage(
  uploadUrlPath: string,
  file: File,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  const invalid = validateImageFile(file);
  if (invalid) throw new Error(invalid);

  const presign = await api.post<PresignedUpload>(uploadUrlPath, {
    contentType: file.type,
    size: file.size,
  });

  await putWithProgress(presign.uploadUrl, file, presign.headers, onProgress, signal);
  return presign.publicUrl;
}

/**
 * Uploads a new avatar for `userId`. Returns the final public URL, which the caller
 * persists via PATCH /users/:id/avatar.
 */
export function uploadAvatar(
  userId: string,
  file: File,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  return uploadImage(`/users/${userId}/avatar/upload-url`, file, onProgress, signal);
}

// Signature image constraints (mirror backend dto/signature-upload.dto.ts).
export const SIGNATURE_ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"] as const;
export const SIGNATURE_MAX_BYTES = 2 * 1024 * 1024; // 2MB
export const SIGNATURE_ACCEPT = SIGNATURE_ALLOWED_MIME.join(",");

/**
 * Uploads a signature image for `userId`. Returns the final public URL, which the caller
 * persists via PATCH /users/:id/signature.
 */
export function uploadSignature(
  userId: string,
  file: File,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  const invalid = validateImageFile(file, {
    maxBytes: SIGNATURE_MAX_BYTES,
    allowed: SIGNATURE_ALLOWED_MIME as readonly string[],
  });
  if (invalid) return Promise.reject(new Error(invalid));
  return uploadImage(`/users/${userId}/signature/upload-url`, file, onProgress, signal);
}

/**
 * Uploads a new logo for the current organization (owner only). Returns the final
 * public URL, which the caller persists via PATCH /organizations/me { logoUrl }.
 */
export function uploadOrgLogo(
  file: File,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  return uploadImage(`/organizations/me/logo/upload-url`, file, onProgress, signal);
}
