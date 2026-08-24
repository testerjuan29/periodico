import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Hash de contraseñas con scrypt (node:crypto — cero dependencias).
 * Formato almacenado: `scrypt:N:r:p:salt_b64:hash_b64` — los parámetros viajan
 * con el hash para poder endurecerlos a futuro sin invalidar los existentes.
 *
 * Solo runtime Node (route handlers) — NUNCA importar desde el middleware Edge.
 */

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const dk = scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt:${N}:${R}:${P}:${salt.toString('base64')}:${dk.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  try {
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const dk = scryptSync(password, salt, expected.length, {
      N: Number(n), r: Number(r), p: Number(p),
    });
    return timingSafeEqual(dk, expected);
  } catch {
    return false;
  }
}

/** Contraseña legible para entregar al usuario nuevo (se muestra una sola vez). */
export function generatePassword(): string {
  // Sin caracteres ambiguos (0/O, 1/l/I) — se dicta por teléfono sin drama.
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(12);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `Pa1-${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}
