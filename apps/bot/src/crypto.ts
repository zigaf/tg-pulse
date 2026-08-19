import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Symmetric encryption for ad-platform credentials at rest (AES-256-GCM).
 *
 * Blob format: `v1:<iv-base64>:<tag-base64>:<ciphertext-base64>`.
 * Rotating ENCRYPTION_KEY invalidates every stored credential by design — the
 * user reconnects the integration. Plaintext and key material are never logged
 * and never appear in error messages.
 */

const ALGORITHM = 'aes-256-gcm';
const FORMAT_VERSION = 'v1';
const KEY_BYTES = 32;
const IV_BYTES = 12; // 96-bit nonce, the size GCM is defined for
const BLOB_PARTS = 4;
const ENV_VAR = 'ENCRYPTION_KEY';

let cachedKey: Buffer | null = null;

/**
 * Read and validate the master key. Resolved lazily so a deployment without
 * integrations still boots; the first encrypt/decrypt is what fails loudly.
 */
function loadKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env[ENV_VAR];
  if (!raw) {
    throw new Error(
      `${ENV_VAR} is not set. Generate one with: node -e "console.log(require('crypto').randomBytes(${KEY_BYTES}).toString('hex'))"`,
    );
  }
  if (!/^[0-9a-fA-F]+$/.test(raw)) {
    throw new Error(`${ENV_VAR} must be hex characters only (${KEY_BYTES * 2} of them)`);
  }
  if (raw.length !== KEY_BYTES * 2) {
    throw new Error(
      `${ENV_VAR} must be ${KEY_BYTES} bytes hex (${KEY_BYTES * 2} chars), got ${raw.length} chars`,
    );
  }

  cachedKey = Buffer.from(raw, 'hex');
  return cachedKey;
}

/** True when a usable ENCRYPTION_KEY is configured; never throws. */
export function isEncryptionConfigured(): boolean {
  try {
    loadKey();
    return true;
  } catch {
    return false;
  }
}

/** Encrypt a JSON-serialisable secret (typically a credentials object). */
export function encryptSecret(plain: unknown): string {
  if (plain === undefined) {
    throw new Error('nothing to encrypt');
  }
  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const serialized = Buffer.from(JSON.stringify(plain), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(serialized), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    FORMAT_VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

/**
 * Decrypt a blob produced by {@link encryptSecret}.
 * Errors describe the failure mode only — never the payload.
 */
export function decryptSecret<T = Record<string, unknown>>(blob: string): T {
  if (typeof blob !== 'string' || blob.length === 0) {
    throw new Error('credential blob is empty');
  }

  const parts = blob.split(':');
  if (parts.length !== BLOB_PARTS) {
    throw new Error('credential blob is malformed');
  }
  const [version, ivB64, tagB64, ctB64] = parts;
  if (version !== FORMAT_VERSION) {
    throw new Error(`unsupported credential format "${version}"`);
  }

  const key = loadKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  if (iv.length !== IV_BYTES) {
    throw new Error('credential blob is malformed');
  }

  let plaintext: string;
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    plaintext = Buffer.concat([
      decipher.update(Buffer.from(ctB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    // Auth-tag mismatch: wrong key or tampered blob. Do not echo any input.
    throw new Error(`credential decryption failed (was ${ENV_VAR} rotated?)`);
  }

  try {
    return JSON.parse(plaintext) as T;
  } catch {
    throw new Error('decrypted credential is not valid JSON');
  }
}

/** Non-reversible hint for the UI, e.g. `token ending in 4f2a`. */
export function secretHint(value: string): string {
  const tail = value.slice(-4);
  return tail.length === 4 ? `ending in ${tail}` : 'hidden';
}
