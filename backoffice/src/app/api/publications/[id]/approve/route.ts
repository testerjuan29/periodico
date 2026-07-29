import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyN8n } from '@/lib/notifyN8n';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const pub = await prisma.publication.update({
    where: { id },
    data: {
      status: 'approved',
      approvedBy: process.env.ADMIN_EMAIL ?? 'admin',
      approvedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      publicationId: id,
      actorEmail: process.env.ADMIN_EMAIL,
      action: 'approve',
    },
  });

  await notifyN8n({ event: 'approved', publicationId: pub.id });

  return NextResponse.json({ ok: true, id: pub.id, status: pub.status });
}
