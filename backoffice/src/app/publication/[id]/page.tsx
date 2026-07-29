import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { StatusBadge } from '@/lib/statusBadge';
import { ApprovalPanel } from './ApprovalPanel';
import { PreviewTabs } from './PreviewTabs';

export const dynamic = 'force-dynamic';

export default async function PublicationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pub = await prisma.publication.findUnique({ where: { id } });
  if (!pub) notFound();

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-4 flex items-center gap-3">
          <StatusBadge status={pub.status} />
          <span className="text-xs uppercase tracking-wider text-gray-500">
            {pub.sourceType} · {pub.sourceSender ?? '—'} · {new Date(pub.receivedAt).toLocaleString('es-CO')}
          </span>
        </div>

        <h1 className="mb-6 font-serif text-3xl font-bold">
          {pub.wpTitle ?? pub.sourceSubject ?? '(sin título)'}
        </h1>

        <PreviewTabs
          wpTitle={pub.wpTitle}
          wpBodyHtml={pub.wpBodyHtml}
          wpExcerpt={pub.wpExcerpt}
          wpCategories={pub.wpCategories}
          wpTags={pub.wpTags}
          fbCaption={pub.fbCaption}
          igCaption={pub.igCaption}
          hashtags={pub.hashtags}
          imageUrl={pub.imageUrl}
        />

        {pub.sourceText && (
          <details className="mt-8 rounded border bg-gray-50 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-gray-700">
              Ver mensaje original
            </summary>
            <pre className="mt-3 whitespace-pre-wrap text-sm text-gray-600">{pub.sourceText}</pre>
          </details>
        )}
      </div>

      <aside>
        <ApprovalPanel id={pub.id} status={pub.status} scheduledAt={pub.scheduledAt} />
      </aside>
    </div>
  );
}
