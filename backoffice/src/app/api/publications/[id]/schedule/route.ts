import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { notifyN8n } from '@/lib/notifyN8n';

const bodySchema = z.object({
  scheduledAt: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = bodySchema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

  const scheduledAt = new Date(body.data.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 });
  }

  const pub = await prisma.publication.update({
    where: { id },
    data: {
      status: 'scheduled',
      scheduledAt,
      approvedBy: process.env.ADMIN_EMAIL ?? 'admin',
      approvedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      publicationId: id,
      actorEmail: process.env.ADMIN_EMAIL,
      action: 'schedule',
      payload: { scheduledAt: scheduledAt.toISOString() },
    },
  });

  await notifyN8n({ event: 'scheduled', publicationId: pub.id, scheduledAt: scheduledAt.toISOString() });

  return NextResponse.json({ ok: true, id: pub.id, status: pub.status });
}
