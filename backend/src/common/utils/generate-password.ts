import * as crypto from 'crypto';

// 12 random bytes -> 16 base64url characters (~96 bits of entropy), mixing
// upper/lowercase letters, digits, and -/_ — well past typical "strong" thresholds.
export function generateStrongPassword(): string {
  return crypto.randomBytes(12).toString('base64url');
}
