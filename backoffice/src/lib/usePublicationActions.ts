'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { scheduleDeferred } from '@/lib/deferredAction';

export type PubAction = 'approve' | 'schedule' | 'reject';

// Aprobar y descartar pasan por la ventana de arrepentimiento; programar no,
// porque elegir una fecha ya es en sí mismo un acto deliberado.
const DEFERRED: Record<PubAction, boolean> = { approve: true, reject: true, schedule: false };

const TOAST_LABEL: Record<PubAction, string> = {
  approve:  'Al aire',
  schedule: 'Programada',
  reject:   'Descartada',
};

type RunOptions = {
  id: string;
  action: PubAction;
  /** Titular — se muestra como subtítulo del aviso de deshacer. */
  label?: string;
  /** ISO UTC. Requerido para 'schedule'. */
  scheduledAt?: string;
  reason?: string;
  /** Corre apenas se dispara la acción (estado optimista de la lista). */
  onOptimistic?: () => void;
  /** Revierte el estado optimista: al deshacer o si el request falla. */
  onRevert?: () => void;
  /** Corre tras un commit exitoso. */
  onCommitted?: () => void;
};

/**
 * Lógica compartida de aprobar / programar / descartar, para que el panel de
 * triage y la página de detalle no diverjan.
 */
export function usePublicationActions() {
  // Acciones dentro de su ventana de deshacer, por id de publicación.
  const [settling, setSettling] = useState<Record<string, PubAction>>({});

  const run = useCallback((opts: RunOptions) => {
    const { id, action, label, scheduledAt = '', reason = '' } = opts;

    const send = async () => {
      const res = await fetch(`/api/publications/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      return data;
    };

    if (DEFERRED[action]) {
      setSettling((s) => ({ ...s, [id]: action }));
      opts.onOptimistic?.();
      scheduleDeferred({
        key: `${id}:${action}`,
        message: TOAST_LABEL[action],
        description: label,
        revert: () => {
          setSettling(({ [id]: _drop, ...rest }) => rest);
          opts.onRevert?.();
        },
        onCommitted: () => {
          setSettling(({ [id]: _drop, ...rest }) => rest);
          opts.onCommitted?.();
        },
        commit: send,
      });
      return;
    }

    // Camino inmediato — programar.
    const toastId = toast.loading('Programando cierre...');
    void (async () => {
      try {
        await send();
        toast.success('Cierre programado', { id: toastId });
        opts.onCommitted?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error de red', { id: toastId });
        opts.onRevert?.();
      }
    })();
  }, []);

  return { run, settling };
}
