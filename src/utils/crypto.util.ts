import * as crypto from 'crypto';

/**
 * Crypto utility for encrypting/decrypting private keys
 * Uses AES-256-GCM with PBKDF2 key derivation
 */

const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

/**
 * Get master encryption key from environment
 * @throws Error if WALLET_MASTER_KEY is not set
 */
function getMasterKey(): string {
  const masterKey = process.env.WALLET_MASTER_KEY;
  if (!masterKey) {
    throw new Error(
      'WALLET_MASTER_KEY not found in environment variables. This key is required for wallet encryption.'
    );
  }
  return masterKey;
}

/**
 * Derive encryption key from master key and salt using PBKDF2
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    masterKey,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    'sha256'
  );
}

/**
 * Encrypt private key with AES-256-GCM
 * @param privateKey - The private key to encrypt (hex string)
 * @returns Object with encrypted data and salt
 */
export function encryptPrivateKey(privateKey: string): {
  encryptedPrivateKey: string;
  salt: string;
} {
  const masterKey = getMasterKey();
  
  // Generate random salt and IV
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Derive encryption key from master key + salt
  const key = deriveKey(masterKey, salt);
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  // Encrypt private key
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Get auth tag
  const authTag = cipher.getAuthTag();
  
  // Combine IV + encrypted data + auth tag
  const combined = Buffer.concat([
    iv,
    Buffer.from(encrypted, 'hex'),
    authTag,
  ]);
  
  return {
    encryptedPrivateKey: combined.toString('base64'),
    salt: salt.toString('hex'),
  };
}

/**
 * Decrypt private key with AES-256-GCM
 * @param encryptedPrivateKey - The encrypted private key (base64)
 * @param salt - The salt used during encryption (hex string)
 * @returns Decrypted private key (hex string)
 */
export function decryptPrivateKey(
  encryptedPrivateKey: string,
  salt: string
): string {
  const masterKey = getMasterKey();
  
  // Convert encrypted data from base64
  const combined = Buffer.from(encryptedPrivateKey, 'base64');
  
  // Extract IV, encrypted data, and auth tag
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);
  
  // Derive encryption key from master key + salt
  const saltBuffer = Buffer.from(salt, 'hex');
  const key = deriveKey(masterKey, saltBuffer);
  
  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  // Decrypt private key
  let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Generate random salt for key derivation
 * @returns Salt as hex string
 */
export function generateSalt(): string {
  return crypto.randomBytes(SALT_LENGTH).toString('hex');
}

/**
 * Test encryption/decryption (for development only)
 */
export function testCrypto() {
  console.log('🔐 Testing crypto functions...');
  
  const testPrivateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  console.log('Original:', testPrivateKey);
  
  const { encryptedPrivateKey, salt } = encryptPrivateKey(testPrivateKey);
  console.log('Encrypted:', encryptedPrivateKey);
  console.log('Salt:', salt);
  
  const decrypted = decryptPrivateKey(encryptedPrivateKey, salt);
  console.log('Decrypted:', decrypted);
  
  console.log('Match:', testPrivateKey === decrypted ? '✅' : '❌');
}
