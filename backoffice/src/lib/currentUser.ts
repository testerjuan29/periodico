import { cookies } from 'next/headers';
import { readSessionToken, SESSION_COOKIE, type SessionUser } from '@/lib/session';

/**
 * Identidad del usuario logueado, leída de la cookie de sesión.
 * Para route handlers y server components (runtime Node).
 * El middleware ya bloqueó a los no autenticados — esto identifica QUIÉN es,
 * para auditoría y para los guards de rol de /api/users.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return readSessionToken(secret, token);
}
