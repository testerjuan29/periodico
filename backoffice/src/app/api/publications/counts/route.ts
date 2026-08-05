import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Conteo por estado para los contadores del nav. Un solo GROUP BY en vez de
// una query por pestaña.
export async function GET() {
  const rows = await prisma.publication.groupBy({
    by: ['status'],
    _count: { _all: true },
  });

  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = r._count._all;

  return NextResponse.json({
    counts,
    // 'active' es el default del dashboard: lo que espera decisión del editor.
    active: (counts.pending ?? 0) + (counts.approved ?? 0) + (counts.scheduled ?? 0),
  });
}
