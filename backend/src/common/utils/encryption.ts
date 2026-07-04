import * as crypto from 'crypto';

// Derives a 32-byte AES-256 key from ENCRYPTION_KEY (any length/passphrase is fine -
// scrypt stretches it to the exact size AES-256-GCM needs).
function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || 'dev-fallback-encryption-key-change-in-production';
  return crypto.scryptSync(secret, 'grovyn-encryption-salt', 32);
}

// Stores as iv:authTag:ciphertext (all hex) so decrypt() is self-contained per value.
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decrypt(payload: string): string {
  const [ivHex, authTagHex, ciphertextHex] = payload.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()]);
  return plaintext.toString('utf8');
}
