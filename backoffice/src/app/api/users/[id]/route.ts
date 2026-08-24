import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/currentUser';
import { generatePassword, hashPassword } from '@/lib/passwords';

// Editar un usuario: rol, activo/inactivo, nombre, reset de contraseña.
// Reglas de seguridad: el admin no puede desactivarse ni degradarse a sí
// mismo, y siempre debe quedar al menos un admin activo.

const SAFE_SELECT = {
  id: true, email: true, name: true, role: true,
  active: true, lastLoginAt: true, createdAt: true,
} as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (me?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo el administrador' }, { status: 403 });
  }
  const { id } = await params;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string; role?: string; active?: boolean; resetPassword?: boolean;
  };

  const data: Record<string, unknown> = {};
  const changes: Record<string, unknown> = {};

  if (typeof body.name === 'string' && body.name.trim()) {
    data.name = body.name.trim();
    changes.name = data.name;
  }

  if (body.role === 'admin' || body.role === 'editor') {
    if (id === me.uid && body.role !== 'admin') {
      return NextResponse.json({ error: 'No podés quitarte el rol de administrador a vos mismo' }, { status: 400 });
    }
    data.role = body.role;
    changes.role = body.role;
  }

  if (typeof body.active === 'boolean') {
    if (id === me.uid && !body.active) {
      return NextResponse.json({ error: 'No podés desactivar tu propia cuenta' }, { status: 400 });
    }
    data.active = body.active;
    changes.active = body.active;
  }

  // ¿La edición dejaría el sistema sin ningún admin activo?
  const becomesNonAdmin = (data.role && data.role !== 'admin') || data.active === false;
  if (target.role === 'admin' && becomesNonAdmin) {
    const otherAdmins = await prisma.user.count({
      where: { role: 'admin', active: true, id: { not: id } },
    });
    if (otherAdmins === 0) {
      return NextResponse.json({ error: 'Debe quedar al menos un administrador activo' }, { status: 400 });
    }
  }

  let password: string | undefined;
  if (body.resetPassword) {
    password = generatePassword();
    data.passwordHash = hashPassword(password);
    changes.passwordReset = true;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }

  const user = await prisma.user.update({ where: { id }, data, select: SAFE_SELECT });

  await prisma.auditLog.create({
    data: {
      actorEmail: me.email,
      action: 'user_update',
      payload: { email: target.email, ...changes },
    },
  });

  return NextResponse.json({ user, ...(password ? { password } : {}) });
}
