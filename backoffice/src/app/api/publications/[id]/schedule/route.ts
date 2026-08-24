import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { notifyN8n } from '@/lib/notifyN8n';
import { getSessionUser } from '@/lib/currentUser';

const bodySchema = z.object({
  scheduledAt: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = bodySchema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

  const scheduledAt = new Date(body.data.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 });
  }
  // Margen de 60s para tolerar diferencias de reloj entre cliente y server.
  if (scheduledAt.getTime() < Date.now() - 60_000) {
    return NextResponse.json({
      error: `La fecha programada debe ser en el futuro. Recibido: ${scheduledAt.toISOString()}, ahora: ${new Date().toISOString()}.`,
    }, { status: 400 });
  }

  const actor = (await getSessionUser())?.email ?? 'sistema';

  // Solo se puede programar desde 'pending'. Si ya está scheduled, aprobada o publicada, no.
  const result = await prisma.publication.updateMany({
    where: { id, status: 'pending' },
    data: {
      status: 'scheduled',
      scheduledAt,
      approvedBy: actor,
      approvedAt: new Date(),
    },
  });

  if (result.count === 0) {
    const current = await prisma.publication.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!current) return NextResponse.json({ error: 'Publicación no encontrada' }, { status: 404 });
    return NextResponse.json({
      error: `No se puede programar: la publicación está en estado "${current.status}". Solo se pueden programar publicaciones pendientes.`,
      currentStatus: current.status,
    }, { status: 409 });
  }

  await prisma.auditLog.create({
    data: {
      publicationId: id,
      actorEmail: actor,
      action: 'schedule',
      payload: { scheduledAt: scheduledAt.toISOString() },
    },
  });

  await notifyN8n({ event: 'scheduled', publicationId: id, scheduledAt: scheduledAt.toISOString() });

  return NextResponse.json({ ok: true, id, status: 'scheduled' });
}
