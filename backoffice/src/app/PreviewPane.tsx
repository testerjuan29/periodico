'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  Radio, Clock, XCircle, Pencil, Loader2, Inbox, ExternalLink, MessageCircle, Mail,
  AlertTriangle, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Timestamp } from '@/components/Timestamp';
import { PreviewTabs } from '@/app/publication/[id]/PreviewTabs';
import { STATUS_LABEL, SETTLED, type Status } from '@/lib/statusLabels';
import { usePublicationActions, type PubAction } from '@/lib/usePublicationActions';
import { cn, isGenerating } from '@/lib/utils';

type Detail = {
  id: string;
  status: string;
  sourceType: string;
  sourceSender: string | null;
  sourceSubject: string | null;
  sourceText: string | null;
  wpTitle: string | null;
  wpBodyHtml: string | null;
  wpExcerpt: string | null;
  wpCategories: string[];
  wpTags: string[];
  fbCaption: string | null;
  igCaption: string | null;
  hashtags: string[];
  imageUrl: string | null;
  receivedAt: string;
  scheduledAt: string | null;
  wpPostUrl: string | null;
  fbPostUrl: string | null;
  igPostUrl: string | null;
};

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

const TAB_BY_INDEX = ['wordpress', 'facebook', 'instagram'] as const;

const CAN_APPROVE  = new Set(['pending']);
const CAN_SCHEDULE = new Set(['pending']);
const CAN_REJECT   = new Set(['pending', 'approved', 'scheduled']);

type Props = {
  id: string | null;
  /** Ejecuta la acción y avanza a la siguiente pendiente. */
  onAct: (id: string, action: PubAction, label: string, scheduledAt?: string) => void;
  settlingAction: PubAction | undefined;
  emptyQueue: boolean;
};

export function PreviewPane({ id, onAct, settlingAction, emptyQueue }: Readonly<Props>) {
  const { data, isLoading } = useSWR<Detail>(
    id ? `/api/publications/${id}` : null,
    fetcher,
    // El refresh también recoge el resultado de una regeneración encolada.
    { revalidateOnFocus: true, keepPreviousData: false, refreshInterval: 15_000 }
  );

  const [tab, setTab] = useState<string>('wordpress');
  const [scheduleAt, setScheduleAt] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const scheduleInput = useRef<HTMLInputElement>(null);

  // Al cambiar de nota volvemos a WordPress y cerramos el programador.
  useEffect(() => { setTab('wordpress'); setShowSchedule(false); setScheduleAt(''); }, [id]);

  // Atajos propios del panel: 1/2/3 cambian de preview, S abre el programador.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const i = ['1', '2', '3'].indexOf(e.key);
      if (i >= 0) { e.preventDefault(); setTab(TAB_BY_INDEX[i]); }
      else if (e.key.toLowerCase() === 's' && data && CAN_SCHEDULE.has(data.status)) {
        e.preventDefault();
        setShowSchedule(true);
        setTimeout(() => scheduleInput.current?.focus(), 30);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [data]);

  if (emptyQueue && !id) return <QueueClosed />;
  if (!id) return <NothingSelected />;
  if (isLoading || !data) return <PaneSkeleton />;

  const label = data.wpTitle ?? data.sourceSubject ?? 'Publicación sin titular';
  const settled = SETTLED.has(data.status);
  const busy = settlingAction !== undefined;
  const SourceIcon = data.sourceType === 'whatsapp' ? MessageCircle : Mail;
  // Sin titular ni cuerpo, el workflow 03 nunca corrió (o falló) para esta nota:
  // los tres previews saldrían vacíos y la pantalla se lee como si estuviera rota.
  const generated = Boolean(data.wpTitle ?? data.wpBodyHtml);

  const act = (action: PubAction, at?: string) => onAct(data.id, action, label, at);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas">
      {/* Barra de contexto: quién mandó esto y cuándo, con identidad */}
      <div className="flex flex-none items-center gap-3 border-b border-divider bg-paper px-5 py-2.5">
        <span
          aria-hidden
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-label font-semibold text-white"
        >
          {(data.sourceSender ?? '?').charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-meta font-semibold text-ink">
            {data.sourceSender ?? '—'}
          </span>
          <span className="flex items-center gap-1.5 text-label text-muted">
            <SourceIcon className="h-3 w-3" />
            {data.sourceType === 'whatsapp' ? 'WhatsApp' : 'Email'}
            {' · recibido '}
            <Timestamp date={data.receivedAt} format="time" className="font-mono" />
          </span>
        </span>
        {data.status !== 'pending' && (
          <span className="rounded-full bg-subtle px-2.5 py-0.5 text-label uppercase tracking-wider text-muted">
            {STATUS_LABEL[data.status as Status] ?? data.status}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {data.wpPostUrl && <OutLink href={data.wpPostUrl}>WordPress</OutLink>}
          {data.fbPostUrl && <OutLink href={data.fbPostUrl}>Facebook</OutLink>}
          {data.igPostUrl && <OutLink href={data.igPostUrl}>Instagram</OutLink>}
          <Link
            href={`/publication/${data.id}`}
            className="inline-flex items-center gap-1.5 rounded border border-divider px-2.5 py-1 text-label text-muted transition-colors hover:border-ink/20 hover:text-ink"
            title="Abrir ficha completa (bitácora, mensaje original)"
          >
            Ficha completa
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Preview */}
      <div className={cn('min-h-0 flex-1 overflow-y-auto p-6', busy && 'opacity-50')}>
        {generated ? (
          <>
            <PreviewTabs
              value={tab}
              onValueChange={setTab}
              wpTitle={data.wpTitle}
              wpBodyHtml={data.wpBodyHtml}
              wpExcerpt={data.wpExcerpt}
              wpCategories={data.wpCategories}
              wpTags={data.wpTags}
              fbCaption={data.fbCaption}
              igCaption={data.igCaption}
              hashtags={data.hashtags}
              imageUrl={data.imageUrl}
            />

            {data.sourceText && (
              <details className="mx-auto mt-8 max-w-[760px] rounded border border-divider bg-surface p-4">
                <summary className="cursor-pointer text-label font-semibold uppercase tracking-wider text-muted hover:text-ink">
                  Ver mensaje original
                </summary>
                <pre className="mt-4 whitespace-pre-wrap font-sans text-meta text-ink/80">{data.sourceText}</pre>
              </details>
            )}
          </>
        ) : (
          <NotGenerated
            id={data.id}
            sourceText={data.sourceText}
            sourceSubject={data.sourceSubject}
            receivedAt={data.receivedAt}
          />
        )}
      </div>

      {/* Programador desplegable */}
      {showSchedule && (
        <div className="flex flex-none items-center gap-2 border-t border-divider bg-subtle/50 px-6 py-3">
          <Clock className="h-4 w-4 flex-none text-schedule" />
          <Input
            ref={scheduleInput}
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
            className="h-9 max-w-[240px]"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!scheduleAt}
            onClick={() => {
              // datetime-local no trae timezone; el server corre en UTC.
              act('schedule', new Date(scheduleAt).toISOString());
              setShowSchedule(false);
            }}
          >
            Confirmar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowSchedule(false)}>
            Cancelar
          </Button>
        </div>
      )}

      {/* Barra de acciones: "Al aire" es EL botón; el resto acompaña.
          La banda fija de atajos murió — vive en el popover del "?". */}
      <div className="relative flex flex-none flex-wrap items-center gap-2 border-t border-divider bg-paper/95 px-5 py-3 backdrop-blur">
        {settled ? (
          <span className="text-meta text-muted">
            Esta publicación está{' '}
            <span className="font-semibold text-ink">{STATUS_LABEL[data.status as Status] ?? data.status}</span>
            {' '}y no admite más acciones.
          </span>
        ) : (
          <>
            <Button
              variant="critical"
              className="px-5 font-semibold shadow-[0_2px_8px_-2px_rgba(185,28,28,0.4)]"
              onClick={() => act('approve')}
              disabled={busy || !CAN_APPROVE.has(data.status) || !generated}
              title={generated ? 'Atajo: A' : 'No se puede publicar una nota sin contenido generado'}
            >
              {settlingAction === 'approve'
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Radio className="h-4 w-4" />}
              Al aire ahora <Kbd>A</Kbd>
            </Button>
            <Button
              variant="outline"
              onClick={() => { setShowSchedule(true); setTimeout(() => scheduleInput.current?.focus(), 30); }}
              disabled={busy || !CAN_SCHEDULE.has(data.status)}
              title="Atajo: S"
            >
              <Clock className="h-4 w-4" />
              Programar <Kbd>S</Kbd>
            </Button>
            <Button variant="outline" asChild title="Atajo: E">
              <Link href={`/publication/${data.id}?edit=1`}>
                <Pencil className="h-4 w-4" />
                Editar <Kbd>E</Kbd>
              </Link>
            </Button>
            <Button
              variant="ghost"
              className="ml-auto text-muted hover:text-ink"
              onClick={() => act('reject')}
              disabled={busy || !CAN_REJECT.has(data.status)}
              title="Atajo: R"
            >
              {settlingAction === 'reject'
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <XCircle className="h-4 w-4" />}
              Descartar <Kbd>R</Kbd>
            </Button>
          </>
        )}

        <button
          type="button"
          aria-label="Atajos de teclado"
          title="Atajos de teclado"
          onClick={() => setShowHelp((v) => !v)}
          className={cn(
            'flex h-8 w-8 flex-none items-center justify-center rounded-full border font-mono text-meta font-semibold transition-colors',
            settled && 'ml-auto',
            showHelp
              ? 'border-ink bg-ink text-paper'
              : 'border-divider bg-surface text-muted hover:border-muted hover:text-ink'
          )}
        >
          ?
        </button>

        {showHelp && (
          <div className="absolute bottom-14 right-4 z-40 w-60 rounded-lg border border-ink/10 bg-surface p-4 shadow-elevated">
            <p className="mb-2.5 text-micro font-semibold uppercase tracking-wider text-muted">
              Atajos de teclado
            </p>
            <HelpRow label="Moverse en la cola"><K>j</K> <K>k</K></HelpRow>
            <HelpRow label="Cambiar preview"><K>1</K> <K>2</K> <K>3</K></HelpRow>
            <HelpRow label="Al aire ahora"><K>A</K></HelpRow>
            <HelpRow label="Programar"><K>S</K></HelpRow>
            <HelpRow label="Editar copy"><K>E</K></HelpRow>
            <HelpRow label="Descartar"><K>R</K></HelpRow>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function OutLink({ href, children }: Readonly<{ href: string; children: React.ReactNode }>) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded border border-approve/30 bg-approve-soft px-2 py-1 text-label text-approve transition-opacity hover:opacity-80"
    >
      {children}
      <ExternalLink className="h-2.5 w-2.5" />
    </a>
  );
}

function Kbd({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <kbd className="ml-1 rounded-sm bg-black/10 px-1.5 font-mono text-micro font-medium">
      {children}
    </kbd>
  );
}

function K({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <kbd className="rounded-sm bg-subtle px-1.5 font-mono text-micro font-semibold text-ink/70">
      {children}
    </kbd>
  );
}

function HelpRow({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-meta text-ink/80">
      <span>{label}</span>
      <span className="flex gap-1">{children}</span>
    </div>
  );
}

function NotGenerated({
  id, sourceText, sourceSubject, receivedAt,
}: Readonly<{ id: string; sourceText: string | null; sourceSubject: string | null; receivedAt: string }>) {
  const [retryState, setRetryState] = useState<'idle' | 'sending' | 'queued'>('idle');
  // Mientras la IA redacta (nota recién llegada) no tiene sentido ofrecer el
  // reintento — el polling del panel (15s) trae el contenido al terminar.
  const generating = isGenerating(receivedAt);

  const retry = async () => {
    setRetryState('sending');
    try {
      const res = await fetch(`/api/publications/${id}/regenerate`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Error ${res.status}`);
      setRetryState('queued');
      toast.success('Regeneración encolada', {
        description: 'La IA va a reprocesar esta nota — el preview se actualiza solo al terminar.',
      });
    } catch (err) {
      setRetryState('idle');
      toast.error(err instanceof Error ? err.message : 'No se pudo encolar la regeneración');
    }
  };

  return (
    <div className="mx-auto max-w-[760px]">
      {generating ? (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-schedule/30 bg-schedule-soft p-4">
          <Loader2 className="mt-0.5 h-4 w-4 flex-none animate-spin text-schedule" />
          <div>
            <p className="text-meta font-semibold text-ink">La IA está redactando esta nota…</p>
            <p className="mt-1 text-meta leading-relaxed text-ink/70">
              Titular, cuerpo, versiones para redes e imagen tardan uno o dos minutos.
              Este panel se actualiza solo al terminar — no hace falta hacer nada.
            </p>
          </div>
        </div>
      ) : (
      <div className="mb-5 flex items-start gap-3 rounded-lg border border-pending/30 bg-pending-soft p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-pending" />
        <div>
          <p className="text-meta font-semibold text-ink">Esta nota todavía no fue generada</p>
          <p className="mt-1 text-meta leading-relaxed text-ink/70">
            Llegó al sistema pero la IA nunca produjo titular, cuerpo ni versiones para redes.
            Publicarla ahora subiría una nota vacía.
          </p>
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={retry}
              disabled={retryState !== 'idle'}
              className="bg-surface"
            >
              {retryState === 'sending' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {retryState === 'idle' && <RefreshCw className="h-3.5 w-3.5" />}
              {retryState === 'queued' ? 'Encolada ✓' : 'Reintentar generación'}
            </Button>
          </div>
        </div>
      </div>
      )}

      <div className="rounded-lg border border-divider bg-surface p-6 shadow-card">
        <h3 className="mb-3 text-label font-semibold uppercase tracking-wider text-muted">
          Lo que sí llegó
        </h3>
        {sourceSubject && (
          <p className="mb-3 font-display text-lead font-semibold text-ink">{sourceSubject}</p>
        )}
        {sourceText ? (
          <pre className="whitespace-pre-wrap font-sans text-meta leading-relaxed text-ink/80">
            {sourceText}
          </pre>
        ) : (
          <p className="text-meta italic text-muted">El mensaje original también vino vacío.</p>
        )}
      </div>
    </div>
  );
}

function QueueClosed() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-canvas p-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-approve-soft text-approve">
        <Inbox className="h-6 w-6" />
      </div>
      <h2 className="mb-2 font-display text-headline font-semibold text-ink">Cola cerrada</h2>
      <p className="max-w-[46ch] text-meta leading-relaxed text-muted">
        No quedan notas esperando decisión. Cuando llegue una nueva por WhatsApp o
        correo va a aparecer sola en el riel y el contador del nav se enciende.
      </p>
    </div>
  );
}

function NothingSelected() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-canvas p-12 text-center">
      <p className="max-w-[42ch] text-meta leading-relaxed text-muted">
        Elegí una nota del riel para verla acá. Con <K>j</K> y <K>k</K> te movés sin tocar el mouse.
      </p>
    </div>
  );
}

function PaneSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas p-6">
      <div className="mb-6 h-8 w-64 animate-pulse rounded bg-subtle" />
      <div className="mb-4 h-56 animate-pulse rounded bg-subtle" />
      <div className="mb-2 h-4 w-full animate-pulse rounded bg-subtle" />
      <div className="mb-2 h-4 w-11/12 animate-pulse rounded bg-subtle" />
      <div className="h-4 w-9/12 animate-pulse rounded bg-subtle" />
    </div>
  );
}
