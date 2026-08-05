import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_S } from '@/lib/session';

// Un solo usuario estático desde el entorno — sin roles ni restricciones.
// Cuando haga falta multi-usuario, este route handler es lo único a migrar.

const enc = new TextEncoder();

/** Compara vía digest SHA-256 en tiempo constante (evita fugas por timing). */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const xa = new Uint8Array(da);
  const xb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < xa.length; i++) diff |= xa[i] ^ xb[i];
  return diff === 0;
}

export async function POST(req: NextRequest) {
  const expectedUser = process.env.ADMIN_USER ?? 'editor';
  const expectedPass = process.env.ADMIN_PASSWORD;
  const secret = process.env.NEXTAUTH_SECRET;

  if (!expectedPass || !secret) {
    return NextResponse.json({
      error: 'Login sin configurar: faltan ADMIN_PASSWORD o NEXTAUTH_SECRET en el entorno.',
    }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as { user?: string; password?: string };
  const okUser = await safeEqual(body.user ?? '', expectedUser);
  const okPass = await safeEqual(body.password ?? '', expectedPass);

  if (!okUser || !okPass) {
    // Freno suave a la fuerza bruta; mensaje genérico a propósito.
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: 'Usuario o contraseña incorrectos.' }, { status: 401 });
  }

  const token = await createSessionToken(secret, expectedUser);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_S,
    // Solo secure bajo HTTPS — en el docker local (http) la cookie no se
    // guardaría con secure:true y el login quedaría en un loop silencioso.
    secure: (process.env.NEXTAUTH_URL ?? '').startsWith('https'),
  });
  return res;
}
