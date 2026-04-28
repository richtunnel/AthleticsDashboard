import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.CHAT_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || 'default-secret-key-at-least-32-bytes-long';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Encrypts a string using AES-256-GCM.
 * Returns a string in the format salt:iv:tag:encrypted
 */
export function encrypt(text: string): string {
  if (!text) return text;
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 1000, 32, 'sha256');
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag().toString('hex');
  
  return `${salt.toString('hex')}:${iv.toString('hex')}:${tag}:${encrypted}`;
}

/**
 * Decrypts a string that was encrypted with the encrypt function.
 * If the string is not in the correct format or decryption fails, returns the original string.
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
  
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 4) return encryptedText;
    
    const [saltHex, ivHex, tagHex, encrypted] = parts;
    
    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    
    const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 1000, 32, 'sha256');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    // If decryption fails, it might be because the text was not encrypted
    return encryptedText;
  }
}
