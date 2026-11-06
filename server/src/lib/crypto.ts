import { createHash, randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

/** A random token for cookies and email links; only its hash is stored. */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

// OWASP-recommended argon2id settings (19 MiB, 2 iterations).
const ARGON2 = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2);
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password).catch(() => false);
}
