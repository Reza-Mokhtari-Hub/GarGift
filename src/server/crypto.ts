import crypto from 'node:crypto';

const DEFAULT_DEV_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function getEncryptionKeyBuffer(): Buffer {
  const envKey = process.env.CODES_ENCRYPTION_KEY || DEFAULT_DEV_KEY;
  if (/^[0-9a-fA-F]{64}$/.test(envKey)) {
    return Buffer.from(envKey, 'hex');
  }
  return crypto.createHash('sha256').update(envKey).digest();
}

/**
 * Encrypts a gift card code with AES-256-GCM.
 * Returns format: ivHex:authTagHex:cipherHex
 */
export function encryptCode(plainText: string): string {
  const key = getEncryptionKeyBuffer();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts an AES-256-GCM encrypted gift card code.
 */
export function decryptCode(encryptedPayload: string): string {
  try {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) return encryptedPayload;
    const [ivHex, authTagHex, cipherHex] = parts;
    const key = getEncryptionKeyBuffer();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(cipherHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return 'INVALID-ENCRYPTED-CODE';
  }
}

/**
 * Hashes a plain password using scrypt with a random 16-byte salt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

/**
 * Verifies a password against a stored scrypt hash.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, keyHex] = storedHash.split(':');
    if (!salt || !keyHex) return false;
    const keyBuffer = Buffer.from(keyHex, 'hex');
    const derivedBuffer = crypto.scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedBuffer.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
  } catch {
    return false;
  }
}

/**
 * Computes a deterministic SHA-256 fingerprint for duplicate code detection within a variant.
 */
export function hashCodeFingerprint(variantId: number, rawCode: string): string {
  const normalized = rawCode.trim().toUpperCase();
  return crypto
    .createHash('sha256')
    .update(`${variantId}:${normalized}`)
    .digest('hex');
}
