import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MessageCircle, Mail } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { StatusBadge } from '@/components/StatusBadge';
import { Timestamp } from '@/components/Timestamp';
import { ApprovalPanel } from './ApprovalPanel';
import { AuditTimeline } from './AuditTimeline';
import { DetailBody } from './DetailBody';

export const dynamic = 'force-dynamic';

export default async function PublicationDetail({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const { id } = await params;
  const sp = await searchParams;
  const pub = await prisma.publication.findUnique({ where: { id } });
  if (!pub) notFound();

  const SourceIcon = pub.sourceType === 'whatsapp' ? MessageCircle : Mail;

  return (
    // <main> es full-bleed para el escritorio de triage; la ficha pone su propio contenedor.
    <div className="mx-auto w-full max-w-7xl overflow-y-auto px-8 py-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-meta text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver a la mesa de edición
      </Link>

      <header className="mb-8 border-b border-divider pb-6">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <StatusBadge status={pub.status} />
          <span className="inline-flex items-center gap-1.5 text-label uppercase tracking-wider text-muted">
            <SourceIcon className="h-3 w-3" />
            {pub.sourceType} · {pub.sourceSender ?? '—'}
          </span>
          <span className="text-label text-muted">·</span>
          <Timestamp date={pub.receivedAt} format="datetime" className="text-label text-muted" />
        </div>
        <h1 className="font-display text-display font-semibold leading-[1.05] text-ink">
          {pub.wpTitle ?? pub.sourceSubject ?? <span className="italic text-muted">Pendiente de titular</span>}
        </h1>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <DetailBody
            id={pub.id}
            status={pub.status}
            wpTitle={pub.wpTitle}
            wpBodyHtml={pub.wpBodyHtml}
            wpExcerpt={pub.wpExcerpt}
            wpCategories={pub.wpCategories}
            wpTags={pub.wpTags}
            fbCaption={pub.fbCaption}
            igCaption={pub.igCaption}
            hashtags={pub.hashtags}
            wpSubtitle={pub.wpSubtitle}
            seoKeyphrase={pub.seoKeyphrase}
            seoKeywords={pub.seoKeywords}
            twCaption={pub.twCaption}
            shareText={pub.shareText}
            wpPostUrl={pub.wpPostUrl}
            imageUrl={pub.imageUrl}
            initialEdit={sp.edit === '1'}
          />

          {pub.sourceText && (
            <details className="mt-8 rounded border border-divider bg-subtle/40 p-4">
              <summary className="cursor-pointer text-label font-semibold uppercase tracking-wider text-muted hover:text-ink">
                Ver mensaje original
              </summary>
              <pre className="mt-4 whitespace-pre-wrap font-sans text-meta text-ink/80">{pub.sourceText}</pre>
            </details>
          )}
        </div>

        <aside className="space-y-6">
          <ApprovalPanel id={pub.id} status={pub.status} scheduledAt={pub.scheduledAt} />
          <AuditTimeline publicationId={pub.id} />
        </aside>
      </div>
    </div>
  );
}
