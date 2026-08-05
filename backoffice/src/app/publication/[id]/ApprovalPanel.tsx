'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Radio, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { STATUS_LABEL, type Status } from '@/lib/statusLabels';
import { scheduleDeferred } from '@/lib/deferredAction';

type Props = {
  id: string;
  status: string;
  scheduledAt: Date | null;
};

type Action = 'approve' | 'schedule' | 'reject';

const CAN_APPROVE  = new Set(['pending']);
const CAN_SCHEDULE = new Set(['pending']);
const CAN_REJECT   = new Set(['pending', 'approved', 'scheduled']);

// Aprobar y descartar pasan por la ventana de arrepentimiento; programar no,
// porque elegir una fecha ya es en sí mismo un acto deliberado.
const DEFERRED: Record<Action, boolean> = { approve: true, reject: true, schedule: false };

const LABELS: Record<Action, { toast: string; done: string }> = {
  approve:  { toast: 'Al aire',    done: 'Al aire — publicando ahora' },
  schedule: { toast: 'Programada', done: 'Cierre programado' },
  reject:   { toast: 'Descartada', done: 'Descartada' },
};

export function ApprovalPanel({ id, status, scheduledAt }: Readonly<Props>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [schedule, setSchedule] = useState(
    scheduledAt ? new Date(scheduledAt).toISOString().slice(0, 16) : ''
  );
  const [reason, setReason] = useState('');
  // Estado optimista mientras corre la ventana de deshacer.
  const [settling, setSettling] = useState<Action | null>(null);
  const scheduleInput = useRef<HTMLInputElement>(null);

  const canApprove  = CAN_APPROVE.has(status)  && !settling;
  const canSchedule = CAN_SCHEDULE.has(status) && !settling;
  const canReject   = CAN_REJECT.has(status)   && !settling;
  const nothingToDo = !CAN_APPROVE.has(status) && !CAN_SCHEDULE.has(status) && !CAN_REJECT.has(status);

  const call = useCallback((action: Action) => {
    // El <input type="datetime-local"> devuelve "YYYY-MM-DDTHH:MM" sin timezone.
    // Convertir a ISO UTC (el navegador aplica la timezone local del usuario).
    // Sin esto, el server (Docker en UTC) interpretaría 10:45 como 10:45 UTC en vez
    // de 10:45 AST → rechazaría cualquier hora antes de las 4 AM local del user.
    const scheduledAtIso = schedule ? new Date(schedule).toISOString() : '';

    const send = async () => {
      const res = await fetch(`/api/publications/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: scheduledAtIso, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      return data;
    };

    if (DEFERRED[action]) {
      setSettling(action);
      scheduleDeferred({
        key: `${id}:${action}`,
        message: LABELS[action].toast,
        description: 'Se puede deshacer durante 10 segundos.',
        revert: () => setSettling(null),
        onCommitted: () => { setSettling(null); router.refresh(); },
        commit: send,
      });
      return;
    }

    // Camino inmediato — programar.
    setActiveAction(action);
    const toastId = toast.loading('Programando cierre...');
    startTransition(async () => {
      try {
        await send();
        toast.success(LABELS[action].done, { id: toastId });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error de red', { id: toastId });
        router.refresh();
      } finally {
        setActiveAction(null);
      }
    });
  }, [id, reason, schedule, router]);

  // ── Atajos de teclado ──────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const k = e.key.toLowerCase();
      if (k === 'a' && canApprove) { e.preventDefault(); call('approve'); }
      else if (k === 'r' && canReject) { e.preventDefault(); call('reject'); }
      else if (k === 's' && canSchedule) {
        e.preventDefault();
        // Sin fecha elegida el atajo enfoca el campo en vez de fallar.
        if (schedule) call('schedule');
        else scheduleInput.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [call, canApprove, canReject, canSchedule, schedule]);

  if (nothingToDo) {
    return (
      <Card className="p-6">
        <h3 className="mb-2 font-display text-lead font-semibold text-ink">Cierre completado</h3>
        <p className="text-meta leading-relaxed text-muted">
          Esta publicación está{' '}
          <span className="font-semibold text-ink">
            {STATUS_LABEL[status as Status] ?? status}
          </span>{' '}
          y no admite más acciones. Consulta la bitácora para el detalle.
        </p>
      </Card>
    );
  }

  const isBusy = (act: Action) => pending && activeAction === act;

  return (
    <Card className="divide-y divide-divider">
      <div className="p-6 pb-4">
        <h3 className="font-display text-lead font-semibold text-ink">
          Escritorio del editor
        </h3>
        {status !== 'pending' && (
          <p className="mt-2 rounded bg-pending-soft px-2 py-1 text-label uppercase tracking-wider text-pending">
            {STATUS_LABEL[status as Status] ?? status} — acciones limitadas
          </p>
        )}
        {settling && (
          <p className="mt-2 flex items-center gap-2 rounded bg-subtle px-2 py-1.5 text-label text-muted">
            <Loader2 className="h-3 w-3 animate-spin" />
            {LABELS[settling].toast} — se puede deshacer desde el aviso.
          </p>
        )}
      </div>

      {/* Al aire ahora */}
      <div className="p-6 py-5">
        <Button
          onClick={() => call('approve')}
          disabled={pending || !canApprove}
          variant="critical"
          size="lg"
          className="w-full"
          title={!canApprove ? `No disponible en estado "${STATUS_LABEL[status as Status] ?? status}"` : 'Atajo: A'}
        >
          {isBusy('approve') ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
          Al aire ahora
          <Kbd>A</Kbd>
        </Button>
        <p className="mt-2 text-label leading-relaxed text-muted">
          Publica en WordPress, Facebook e Instagram. Hay 10 segundos para deshacerlo
          antes de que salga el request.
        </p>
      </div>

      {/* Programar cierre */}
      <div className="p-6 py-5">
        <Label htmlFor="schedule-at" className="mb-2 block">
          Programar cierre
        </Label>
        <Input
          id="schedule-at"
          ref={scheduleInput}
          type="datetime-local"
          value={schedule}
          onChange={(e) => setSchedule(e.target.value)}
          disabled={pending || !canSchedule}
          className="mb-2"
        />
        <Button
          onClick={() => call('schedule')}
          disabled={pending || !canSchedule || !schedule}
          variant="outline"
          size="sm"
          className="w-full"
          title="Atajo: S"
        >
          {isBusy('schedule') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
          Programar
          <Kbd>S</Kbd>
        </Button>
      </div>

      <Separator />

      {/* Descartar */}
      <div className="p-6 py-5">
        <Label htmlFor="reject-reason" className="mb-2 block">
          Descartar
        </Label>
        <Textarea
          id="reject-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo (opcional)"
          disabled={pending || !canReject}
          rows={2}
          className="mb-2 text-meta"
        />
        <Button
          onClick={() => call('reject')}
          disabled={pending || !canReject}
          variant="ghost"
          size="sm"
          className="w-full text-muted hover:text-ink"
          title="Atajo: R"
        >
          {isBusy('reject') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
          Descartar
          <Kbd>R</Kbd>
        </Button>
      </div>
    </Card>
  );
}

function Kbd({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <kbd className="ml-auto rounded-sm bg-black/10 px-1.5 font-mono text-micro font-medium">
      {children}
    </kbd>
  );
}
