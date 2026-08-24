import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyN8n } from '@/lib/notifyN8n';
import { getSessionUser } from '@/lib/currentUser';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = (await getSessionUser())?.email ?? 'sistema';

  // UPDATE atómico: solo transita si el estado actual es 'pending'.
  // Previene doble-aprobación y race conditions entre pestañas/usuarios.
  const result = await prisma.publication.updateMany({
    where: { id, status: 'pending' },
    data: {
      status: 'approved',
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
      error: `No se puede aprobar: la publicación está en estado "${current.status}". Solo se pueden aprobar publicaciones pendientes.`,
      currentStatus: current.status,
    }, { status: 409 });
  }

  await prisma.auditLog.create({
    data: { publicationId: id, actorEmail: actor, action: 'approve' },
  });

  await notifyN8n({ event: 'approved', publicationId: id });

  return NextResponse.json({ ok: true, id, status: 'approved' });
}
