import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/currentUser';
import { generatePassword, hashPassword } from '@/lib/passwords';

// Gestión de usuarios — solo admin. El middleware ya corta a los editores;
// este guard repite el chequeo por defensa en profundidad.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SAFE_SELECT = {
  id: true, email: true, name: true, role: true,
  active: true, lastLoginAt: true, createdAt: true,
} as const;

export async function GET() {
  const me = await getSessionUser();
  if (me?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo el administrador' }, { status: 403 });
  }
  const users = await prisma.user.findMany({
    select: SAFE_SELECT,
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  });
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (me?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo el administrador' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    email?: string; name?: string; role?: string;
  };
  const email = (body.email ?? '').trim().toLowerCase();
  const name = (body.name ?? '').trim();
  const role = body.role === 'admin' ? 'admin' : 'editor';

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Correo inválido' }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
  }
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: 'Ya existe un usuario con ese correo' }, { status: 409 });
  }

  // La contraseña se genera en el servidor y se muestra UNA vez al admin.
  const password = generatePassword();
  const user = await prisma.user.create({
    data: { email, name, role, passwordHash: hashPassword(password), active: true },
    select: SAFE_SELECT,
  });

  await prisma.auditLog.create({
    data: {
      actorEmail: me.email,
      action: 'user_create',
      payload: { email, name, role },
    },
  });

  return NextResponse.json({ user, password });
}
