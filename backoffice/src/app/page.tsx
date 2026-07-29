import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { StatusBadge } from '@/lib/statusBadge';

export const dynamic = 'force-dynamic';

const DEFAULT_STATUSES = ['pending', 'approved', 'scheduled'];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const where = status ? { status } : { status: { in: DEFAULT_STATUSES } };

  const publications = await prisma.publication.findMany({
    where,
    orderBy: { receivedAt: 'desc' },
    take: 50,
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-bold">
          {status ? `Publicaciones (${status})` : 'Bandeja de aprobación'}
        </h1>
        <span className="text-sm text-gray-500">{publications.length} publicaciones</span>
      </div>

      {publications.length === 0 && (
        <div className="rounded-lg border border-dashed bg-white p-12 text-center text-gray-500">
          No hay publicaciones para mostrar.
        </div>
      )}

      <ul className="space-y-3">
        {publications.map((p) => (
          <li key={p.id}>
            <Link
              href={`/publication/${p.id}`}
              className="flex items-center gap-4 rounded-lg border bg-white p-4 shadow-sm transition hover:border-brand hover:shadow"
            >
              {p.imageUrl ? (
                <img
                  src={`/api/image?path=${encodeURIComponent(p.imageUrl)}`}
                  alt=""
                  className="h-20 w-20 flex-none rounded object-cover"
                />
              ) : (
                <div className="h-20 w-20 flex-none rounded bg-gray-100" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <StatusBadge status={p.status} />
                  <span className="text-xs uppercase tracking-wider text-gray-500">
                    {p.sourceType} · {p.sourceSender ?? '—'}
                  </span>
                </div>
                <h2 className="mt-1 truncate font-serif text-lg font-semibold">
                  {p.wpTitle ?? p.sourceSubject ?? '(sin título)'}
                </h2>
                <p className="mt-1 line-clamp-1 text-sm text-gray-600">
                  {p.wpExcerpt ?? p.sourceText ?? ''}
                </p>
              </div>
              <div className="flex-none text-right text-xs text-gray-500">
                {new Date(p.receivedAt).toLocaleString('es-CO')}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
