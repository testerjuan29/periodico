import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// Por default excluimos drafts (WA en construcción) — el editor ve solo lo listo para su decisión.
// Para verlos, filtro explícito con ?status=draft.
const DEFAULT_STATUSES = ['pending', 'approved', 'scheduled'];
const ALLOWED_STATUSES = new Set([
  'draft', 'pending', 'approved', 'scheduled', 'publishing',
  'published', 'partial', 'failed', 'rejected',
]);
const ALLOWED_SOURCES = new Set(['email', 'whatsapp']);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const status = sp.get('status');
  const source = sp.get('source');
  const q = sp.get('q')?.trim() ?? '';
  const page = Math.max(1, Number.parseInt(sp.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(sp.get('pageSize') ?? '20', 10) || 20));

  const where: Prisma.PublicationWhereInput = {};
  if (status && status !== 'all') {
    if (!ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 });
    }
    where.status = status;
  } else if (!status) {
    where.status = { in: DEFAULT_STATUSES };
  }
  if (source && source !== 'all') {
    if (!ALLOWED_SOURCES.has(source)) {
      return NextResponse.json({ error: 'invalid source' }, { status: 400 });
    }
    where.sourceType = source;
  }
  if (q) {
    where.OR = [
      { wpTitle:      { contains: q, mode: 'insensitive' } },
      { sourceText:   { contains: q, mode: 'insensitive' } },
      { sourceSender: { contains: q, mode: 'insensitive' } },
      { sourceSubject:{ contains: q, mode: 'insensitive' } },
    ];
  }

  const [total, data] = await Promise.all([
    prisma.publication.count({ where }),
    prisma.publication.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        sourceType: true,
        sourceSender: true,
        sourceSubject: true,
        sourceText: true,
        wpTitle: true,
        wpExcerpt: true,
        imageUrl: true,
        status: true,
        receivedAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    data,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
