import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const entries = await prisma.auditLog.findMany({
    where: { publicationId: id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return NextResponse.json({ entries });
}
