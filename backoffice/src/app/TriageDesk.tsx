'use client';

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { MessageCircle, Mail, RefreshCw, Check, X, Loader2, AlertCircle, AlertTriangle } from 'lucide-react';
import { Timestamp } from '@/components/Timestamp';
import { ShortcutsTip } from '@/components/ShortcutsTip';
import { DashboardFilters } from './DashboardFilters';
import { PreviewPane } from './PreviewPane';
import { STATUS_RULE, STATUS_SHORT, SETTLED, type Status } from '@/lib/statusLabels';
import { usePublicationActions, type PubAction } from '@/lib/usePublicationActions';
import { cn, isGenerating } from '@/lib/utils';

type Publication = {
  id: string;
  sourceType: string;
  sourceSender: string | null;
  sourceSubject: string | null;
  sourceText: string | null;
  wpTitle: string | null;
  wpExcerpt: string | null;
  imageUrl: string | null;
  status: string;
  receivedAt: string;
};

type ApiResponse = {
  data: Publication[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

export function TriageDesk() {
  const params = useSearchParams();
  const router = useRouter();

  // 'active' es nuestro default y se traduce a "sin filtro" (backend usa DEFAULT_STATUSES).
  const fp = new URLSearchParams(params.toString());
  if (fp.get('status') === 'active') fp.delete('status');
  // El riel muestra más filas que la vieja lista de tarjetas.
  if (!fp.has('pageSize')) fp.set('pageSize', '50');
  const key = `/api/publications?${fp.toString()}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<ApiResponse>(key, fetcher, {
    refreshInterval: 10_000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  const items = useMemo(() => data?.data ?? [], [data]);
  const { run, settling } = usePublicationActions();

  const [selId, setSelId] = useState<string | null>(null);
  // Estados optimistas mientras corre la ventana de deshacer.
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const statusOf = useCallback(
    (p: Publication) => optimistic[p.id] ?? p.status,
    [optimistic]
  );

  // Selección inicial (y recuperación si la nota seleccionada desaparece del filtro).
  useEffect(() => {
    if (items.length === 0) { setSelId(null); return; }
    if (selId && items.some((p) => p.id === selId)) return;
    const firstOpen = items.find((p) => !SETTLED.has(statusOf(p)));
    setSelId((firstOpen ?? items[0]).id);
  }, [items, selId, statusOf]);

  const selIndex = items.findIndex((p) => p.id === selId);

  /** Siguiente nota que todavía admite decisión; null si no queda ninguna. */
  const nextOpen = useCallback((fromId: string): string | null => {
    const from = items.findIndex((p) => p.id === fromId);
    for (let i = from + 1; i < items.length; i++) {
      if (!SETTLED.has(statusOf(items[i])) && items[i].id !== fromId) return items[i].id;
    }
    for (let i = 0; i < from; i++) {
      if (!SETTLED.has(statusOf(items[i]))) return items[i].id;
    }
    return null;
  }, [items, statusOf]);

  /** Ejecuta la acción, avanza sola a la siguiente y refresca los contadores. */
  const act = useCallback((id: string, action: PubAction, label: string, scheduledAt?: string) => {
    const optimisticStatus =
      action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'scheduled';

    run({
      id, action, label, scheduledAt,
      onOptimistic: () => setOptimistic((o) => ({ ...o, [id]: optimisticStatus })),
      onRevert: () => setOptimistic(({ [id]: _drop, ...rest }) => rest),
      onCommitted: () => {
        setOptimistic(({ [id]: _drop, ...rest }) => rest);
        void mutate();
        router.refresh();
      },
    });

    // Avanzar de inmediato: el editor no espera a que venza la ventana.
    const nxt = nextOpen(id);
    setSelId(nxt);
  }, [run, mutate, router, nextOpen]);

  // ── Teclado global del escritorio ──────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (items.length === 0) return;

      const k = e.key.toLowerCase();
      const cur = selIndex >= 0 ? items[selIndex] : null;

      if (k === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const n = Math.min((selIndex < 0 ? -1 : selIndex) + 1, items.length - 1);
        setSelId(items[n].id);
      } else if (k === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = Math.max((selIndex < 0 ? 1 : selIndex) - 1, 0);
        setSelId(items[n].id);
      } else if (k === 'e' && cur) {
        e.preventDefault();
        router.push(`/publication/${cur.id}?edit=1`);
      // Sin titular generado no hay nada que publicar — el atajo no debe disparar.
      } else if (k === 'a' && cur?.wpTitle && statusOf(cur) === 'pending' && !settling[cur.id]) {
        e.preventDefault();
        act(cur.id, 'approve', cur.wpTitle ?? cur.sourceSubject ?? 'Publicación sin titular');
      } else if (k === 'r' && cur && !SETTLED.has(statusOf(cur)) && !settling[cur.id]) {
        e.preventDefault();
        act(cur.id, 'reject', cur.wpTitle ?? cur.sourceSubject ?? 'Publicación sin titular');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, selIndex, statusOf, settling, act, router]);

  // Mantener la fila seleccionada a la vista.
  useEffect(() => {
    if (selId) rowRefs.current[selId]?.scrollIntoView({ block: 'nearest' });
  }, [selId]);

  const openCount = items.filter((p) => !SETTLED.has(statusOf(p))).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ShortcutsTip />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* ── Riel ── */}
        <aside className="flex w-[400px] flex-none flex-col border-r border-divider bg-paper xl:w-[460px] 2xl:w-[520px]">
          <div className="flex-none border-b border-divider p-3">
            <DashboardFilters />
          </div>

          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
            {isLoading && !data && <RailSkeleton />}
            {error && (
              <div className="p-6 text-center">
                <p className="mb-2 text-meta text-brand-dark">No pudimos cargar la cola.</p>
                <button
                  onClick={() => mutate()}
                  className="text-meta font-medium text-brand-dark underline underline-offset-2"
                >
                  Reintentar
                </button>
              </div>
            )}
            {!isLoading && items.length === 0 && (
              <p className="p-6 text-center text-meta text-muted">
                No hay publicaciones para los filtros seleccionados.
              </p>
            )}
            {items.map((p) => (
              <RailRow
                key={p.id}
                ref={(el) => { rowRefs.current[p.id] = el; }}
                publication={p}
                status={statusOf(p)}
                selected={p.id === selId}
                busy={settling[p.id] !== undefined}
                onSelect={() => setSelId(p.id)}
                onAct={(a) => act(p.id, a, p.wpTitle ?? p.sourceSubject ?? 'Publicación sin titular')}
              />
            ))}
          </div>

          <div className="flex flex-none items-center justify-between border-t border-divider px-4 py-2 text-label text-muted">
            <span className="inline-flex items-center gap-1.5">
              {openCount === 0 ? 'cola vacía' : `${openCount} en cola`}
              {isValidating && !isLoading && <RefreshCw className="h-2.5 w-2.5 animate-spin opacity-60" />}
            </span>
            <span className="font-mono tabular-nums">{data?.total ?? 0} en total</span>
          </div>
        </aside>

        {/* ── Panel ── */}
        <PreviewPane
          id={selId}
          onAct={act}
          settlingAction={selId ? settling[selId] : undefined}
          emptyQueue={items.length > 0 && openCount === 0}
        />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

type RowProps = {
  publication: Publication;
  status: string;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
  onAct: (a: PubAction) => void;
};

const RailRow = forwardRef<HTMLDivElement, RowProps>(function RailRow(
  { publication: p, status, selected, busy, onSelect, onAct }, ref
) {
  const SourceIcon = p.sourceType === 'whatsapp' ? MessageCircle : Mail;
  const settled = SETTLED.has(status);
  const title = p.wpTitle ?? p.sourceSubject;
  const imgSrc = p.imageUrl ? `/api/image?path=${encodeURIComponent(p.imageUrl)}` : null;
  // Recién llegada y sin contenido = la IA la está redactando ahora mismo.
  // El polling del riel (10s) la convierte en tarjeta completa al terminar.
  const generating = status === 'pending' && !p.wpTitle && isGenerating(p.receivedAt);

  return (
    // Tarjeta, no fila: la seleccionada flota con borde + sombra sobre el riel.
    <div
      ref={ref}
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      onClick={onSelect}
      className={cn(
        'group relative flex w-full cursor-pointer items-center gap-3 rounded-md border py-2.5 pl-4 pr-3 transition-all',
        selected
          ? 'border-divider bg-surface shadow-cardHover'
          : 'border-transparent hover:bg-canvas',
        busy && 'opacity-50'
      )}
    >
      {/* La regla de estado se ve siempre, no solo en hover */}
      <span
        aria-hidden
        className={cn('absolute bottom-3 left-1.5 top-3 w-[3px] rounded-full', STATUS_RULE[status as Status])}
      />

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <Timestamp date={p.receivedAt} format="time" className="font-mono text-micro text-muted" />
          <SourceIcon className="h-3 w-3 flex-none text-muted" aria-label={p.sourceType} />
          {status !== 'pending' && (
            <span className="truncate rounded-full bg-subtle px-2 text-micro uppercase tracking-wider text-muted">
              {STATUS_SHORT[status as Status] ?? status}
            </span>
          )}
          {busy && <Loader2 className="ml-auto h-3 w-3 flex-none animate-spin text-muted" />}

          {/* Acciones rápidas: evitan tener que leer la nota si ya sabés qué hacer */}
          {!settled && !busy && (
            <span className="ml-auto flex flex-none items-center gap-1 rounded-md bg-surface opacity-0 shadow-card transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              {status === 'pending' && p.wpTitle && (
                <Quick title="Al aire (A)" tone="approve" onClick={(e) => { e.stopPropagation(); onAct('approve'); }}>
                  <Check className="h-3 w-3" />
                </Quick>
              )}
              <Quick title="Descartar (R)" tone="brand" onClick={(e) => { e.stopPropagation(); onAct('reject'); }}>
                <X className="h-3 w-3" />
              </Quick>
            </span>
          )}
        </div>

        <p
          className={cn(
            'line-clamp-2 font-display text-body font-semibold leading-snug',
            selected ? 'text-ink' : 'text-ink/75',
            settled && 'text-ink/45',
            busy && 'line-through decoration-ink/30'
          )}
        >
          {title ?? (generating ? (
            <span className="inline-flex items-center gap-1.5 font-sans text-meta font-medium text-schedule">
              <Loader2 className="h-3.5 w-3.5 flex-none animate-spin" />
              Generando la nota con IA…
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-sans text-meta font-medium text-pending">
              <AlertCircle className="h-3.5 w-3.5 flex-none" />
              Sin contenido generado
            </span>
          ))}
        </p>

        {/* Sin titular generado, el mensaje crudo es lo único que distingue
            una fila de otra — sin esto el riel es una lista de clones. */}
        {(p.wpExcerpt ?? p.sourceText) && (
          <p className="mt-0.5 line-clamp-1 text-meta leading-snug text-muted">
            {p.wpExcerpt ?? p.sourceText}
          </p>
        )}
      </div>

      {/* Miniatura: el ancla de reconocimiento del riel */}
      {imgSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgSrc}
          alt=""
          loading="lazy"
          className="h-[46px] w-[46px] flex-none rounded-md object-cover ring-1 ring-divider"
        />
      ) : generating ? (
        <span
          className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-md bg-schedule-soft text-schedule ring-1 ring-schedule/30"
          aria-hidden
        >
          <Loader2 className="h-4 w-4 animate-spin" />
        </span>
      ) : title ? (
        <span className="h-[46px] w-[46px] flex-none rounded-md bg-subtle ring-1 ring-divider" aria-hidden />
      ) : (
        <span
          className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-md border border-dashed border-pending/40 bg-pending-soft/50 text-pending"
          aria-hidden
        >
          <AlertTriangle className="h-4 w-4" />
        </span>
      )}
    </div>
  );
});

function Quick({
  title, tone, onClick, children,
}: Readonly<{
  title: string;
  tone: 'approve' | 'brand';
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}>) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded border bg-surface transition-colors',
        tone === 'approve' && 'border-approve/30 text-approve hover:bg-approve-soft',
        tone === 'brand'   && 'border-brand/30 text-brand hover:bg-brand-soft'
      )}
    >
      {children}
    </button>
  );
}

function RailSkeleton() {
  return (
    <div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex border-b border-divider">
          <span className="w-[3px] flex-none bg-subtle" />
          <div className="flex-1 px-3 py-2.5">
            <div className="mb-2 h-2.5 w-20 animate-pulse rounded-sm bg-subtle" />
            <div className="mb-1.5 h-3 w-full animate-pulse rounded-sm bg-subtle" />
            <div className="h-3 w-3/5 animate-pulse rounded-sm bg-subtle" />
          </div>
        </div>
      ))}
    </div>
  );
}
