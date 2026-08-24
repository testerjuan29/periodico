import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/currentUser';

// Reencola una nota en el workflow de generación (03) vía el webhook del
// workflow 09. Existe para rescatar notas que se ingirieron pero cuya
// generación nunca corrió o falló.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const pub = await prisma.publication.findUnique({
    where: { id },
    select: { status: true, wpTitle: true },
  });
  if (!pub) return NextResponse.json({ error: 'Publicación no encontrada' }, { status: 404 });

  // Solo notas pendientes sin contenido: regenerar una nota ya generada
  // pisaría ediciones del editor (el workflow 03 sobreescribe todo).
  if (pub.status !== 'pending') {
    return NextResponse.json({
      error: `No se puede regenerar en estado "${pub.status}".`,
    }, { status: 409 });
  }
  if (pub.wpTitle) {
    return NextResponse.json({
      error: 'Esta nota ya tiene contenido generado. Regenerarla pisaría las ediciones — editála en su lugar.',
    }, { status: 409 });
  }

  const webhook = process.env.N8N_GENERATE_WEBHOOK ?? 'http://n8n:5678/webhook/generate-content';
  let res: Response;
  try {
    res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicationId: id }),
    });
  } catch {
    return NextResponse.json({ error: 'No se pudo contactar a n8n.' }, { status: 502 });
  }
  if (res.status === 404) {
    // El webhook no existe hasta importar y publicar el workflow 09.
    return NextResponse.json({
      error: 'El workflow "09 Regenerate Content" no está publicado en n8n.',
    }, { status: 502 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: `n8n respondió ${res.status}.` }, { status: 502 });
  }

  await prisma.auditLog.create({
    data: {
      publicationId: id,
      actorEmail: (await getSessionUser())?.email ?? 'sistema',
      action: 'regenerate',
    },
  });

  return NextResponse.json({ ok: true, id });
}
