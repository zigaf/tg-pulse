import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { requireEnv } from './env';

/**
 * Symmetric encryption for ad-platform credentials at rest (docs/AD-INTEGRATIONS.md).
 *
 * Wire format, byte for byte identical to the bot's implementation so either process
 * can read what the other wrote:
 *
 *   v1:<iv-base64>:<tag-base64>:<ciphertext-base64>
 *
 * AES-256-GCM, 12-byte random IV per message, 16-byte auth tag.
 * `ENCRYPTION_KEY` is 32 random bytes hex-encoded (64 hex chars). Rotating it invalidates
 * every stored credential by design: the user reconnects the integration.
 */

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Thrown when a stored blob cannot be read back; callers surface "reconnect this integration". */
export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}

function encryptionKey(): Buffer {
  const raw = requireEnv('ENCRYPTION_KEY').trim();
  if (!/^[0-9a-fA-F]+$/.test(raw) || raw.length !== KEY_BYTES * 2) {
    throw new Error(`ENCRYPTION_KEY must be ${KEY_BYTES} bytes hex-encoded (${KEY_BYTES * 2} hex chars)`);
  }
  return Buffer.from(raw, 'hex');
}

/** True when the key is configured and well formed; lets routes fail with a clear 500 instead of a stack. */
export function isEncryptionConfigured(): boolean {
  try {
    encryptionKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSION, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new DecryptionError('Unsupported ciphertext format');
  }

  const iv = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const ciphertext = Buffer.from(parts[3], 'base64');
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new DecryptionError('Corrupted ciphertext header');
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    // Wrong key or tampered blob; both mean the same thing to the caller.
    throw new DecryptionError('Could not decrypt stored credentials');
  }
}

/** Encrypt a credentials object; the column holds one blob, not one row per field. */
export function encryptJson(value: unknown): string {
  return encryptSecret(JSON.stringify(value));
}

export function decryptJson<T = unknown>(payload: string): T {
  const plaintext = decryptSecret(payload);
  try {
    return JSON.parse(plaintext) as T;
  } catch {
    throw new DecryptionError('Stored credentials are not valid JSON');
  }
}
