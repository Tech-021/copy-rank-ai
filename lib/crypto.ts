import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

export function getEncryptionKey(): string {
  // Prefer FRAMER_ENCRYPTION_KEY, fall back to WORDPRESS_ENCRYPTION_KEY or WEBFLOW_ENCRYPTION_KEY if available
  const key = process.env.FRAMER_ENCRYPTION_KEY || process.env.WORDPRESS_ENCRYPTION_KEY || process.env.WEBFLOW_ENCRYPTION_KEY;
  if (!key) throw new Error('Missing encryption key. Set FRAMER_ENCRYPTION_KEY, WORDPRESS_ENCRYPTION_KEY, or WEBFLOW_ENCRYPTION_KEY environment variable.');
  return key;
}

export function encryptText(text: string, encryptionKey?: string): string {
  const key = encryptionKey || getEncryptionKey();
  const derived = crypto.scryptSync(key, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, derived, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptText(encrypted: string, encryptionKey?: string): string {
  const key = encryptionKey || getEncryptionKey();
  const derived = crypto.scryptSync(key, 'salt', 32);
  const parts = encrypted.split(':');
  if (parts.length !== 2) throw new Error('Invalid encrypted text format');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  const decipher = crypto.createDecipheriv(ALGORITHM, derived, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
