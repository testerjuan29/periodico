import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Estados desde los cuales sí se puede rechazar (antes de publicar de verdad).
const REJECTABLE = ['pending', 'approved', 'scheduled'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { reason } = (await req.json().catch(() => ({}))) as { reason?: string };

  const actor = process.env.ADMIN_EMAIL ?? 'admin';

  // Solo se puede rechazar si aún no se publicó (ni está publicando).
  const result = await prisma.publication.updateMany({
    where: { id, status: { in: REJECTABLE } },
    data: {
      status: 'rejected',
      rejectedReason: reason ?? null,
    },
  });

  if (result.count === 0) {
    const current = await prisma.publication.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!current) return NextResponse.json({ error: 'Publicación no encontrada' }, { status: 404 });
    return NextResponse.json({
      error: `No se puede rechazar: la publicación está en estado "${current.status}". Solo se pueden rechazar antes de publicar.`,
      currentStatus: current.status,
    }, { status: 409 });
  }

  await prisma.auditLog.create({
    data: {
      publicationId: id,
      actorEmail: actor,
      action: 'reject',
      payload: { reason: reason ?? null },
    },
  });

  return NextResponse.json({ ok: true, id, status: 'rejected' });
}
