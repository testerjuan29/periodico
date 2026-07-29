import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { reason } = (await req.json().catch(() => ({}))) as { reason?: string };

  const pub = await prisma.publication.update({
    where: { id },
    data: {
      status: 'rejected',
      rejectedReason: reason ?? null,
    },
  });

  await prisma.auditLog.create({
    data: {
      publicationId: id,
      actorEmail: process.env.ADMIN_EMAIL,
      action: 'reject',
      payload: { reason: reason ?? null },
    },
  });

  return NextResponse.json({ ok: true, id: pub.id, status: pub.status });
}
