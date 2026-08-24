import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/passwords';
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_S, type SessionUser } from '@/lib/session';

/**
 * Login multi-usuario (un admin + varios editores, tabla `users`).
 *
 * Bootstrap: mientras ningún usuario tenga contraseña en la base, las
 * credenciales del entorno (ADMIN_USER/ADMIN_PASSWORD) siguen funcionando y el
 * primer login exitoso crea el admin real — migración sin pasos manuales.
 */

async function fail(): Promise<NextResponse> {
  // Freno suave a la fuerza bruta; mensaje genérico a propósito.
  await new Promise((r) => setTimeout(r, 600));
  return NextResponse.json({ error: 'Usuario o contraseña incorrectos.' }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({
      error: 'Login sin configurar: falta NEXTAUTH_SECRET en el entorno.',
    }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as { user?: string; password?: string };
  const loginId = (body.user ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  if (!loginId || !password) return fail();

  // El admin de bootstrap puede entrar con el alias del .env ("editor") o con
  // el correo — así los accesos ya entregados siguen funcionando tal cual.
  const envUser = (process.env.ADMIN_USER ?? 'editor').toLowerCase();
  const envEmail = (process.env.ADMIN_EMAIL ?? 'admin@paginauno.do').toLowerCase();
  const lookupEmail = loginId === envUser ? envEmail : loginId;

  let user = await prisma.user.findUnique({ where: { email: lookupEmail } });

  if (!user?.passwordHash) {
    // ¿Estamos en bootstrap? Solo si NADIE tiene contraseña todavía.
    const withPassword = await prisma.user.count({ where: { passwordHash: { not: null } } });
    const envPass = process.env.ADMIN_PASSWORD;
    const matchesEnv = Boolean(envPass)
      && (loginId === envUser || loginId === envEmail)
      && password === envPass;

    if (withPassword > 0 || !matchesEnv) return fail();

    user = await prisma.user.upsert({
      where: { email: envEmail },
      update: { role: 'admin', passwordHash: hashPassword(password), active: true },
      create: {
        email: envEmail,
        name: 'Administrador',
        role: 'admin',
        passwordHash: hashPassword(password),
        active: true,
      },
    });
  } else if (!verifyPassword(password, user.passwordHash)) {
    return fail();
  }

  if (!user.active) return fail();

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const sessionUser: SessionUser = {
    uid: user.id,
    email: user.email,
    name: user.name ?? user.email,
    role: user.role === 'admin' ? 'admin' : 'editor',
  };
  const token = await createSessionToken(secret, sessionUser);
  const res = NextResponse.json({ ok: true, user: sessionUser });
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
