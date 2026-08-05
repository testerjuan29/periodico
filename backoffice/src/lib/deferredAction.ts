'use client';

import { toast } from 'sonner';

/**
 * Acciones con ventana de arrepentimiento.
 *
 * Publicar dispara webhooks a WordPress, Facebook e Instagram — y eso no se
 * deshace. En vez de confirmar con un modal (que se vuelve ruido y el editor
 * termina aceptando sin leer), diferimos la llamada real: la UI reacciona al
 * instante y el request sale recién cuando vence la ventana.
 *
 * Consecuencia deliberada: si la ventana no vence, en la DB no pasó NADA.
 * Nada de estados intermedios que limpiar. El precio es que cerrar la pestaña
 * durante la espera cancela la acción — por eso `DeferredGuard` avisa antes.
 */

const DEFAULT_DELAY_MS = 10_000;

type Entry = {
  timer: ReturnType<typeof setTimeout>;
  toastId: string | number;
  commit: () => Promise<unknown>;
  revert: () => void;
};

const inflight = new Map<string, Entry>();
const listeners = new Set<(n: number) => void>();

function announce() {
  for (const fn of listeners) fn(inflight.size);
}

export function subscribeDeferred(fn: (n: number) => void): () => void {
  listeners.add(fn);
  fn(inflight.size);
  return () => { listeners.delete(fn); };
}

export function hasDeferred(): boolean {
  return inflight.size > 0;
}

/** Cancela sin ejecutar y revierte el estado optimista. */
export function cancelDeferred(key: string) {
  const e = inflight.get(key);
  if (!e) return;
  clearTimeout(e.timer);
  toast.dismiss(e.toastId);
  inflight.delete(key);
  e.revert();
  announce();
}

type ScheduleOptions = {
  /** Identidad de la acción — normalmente `${publicationId}:${action}`. */
  key: string;
  /** Texto principal del toast. */
  message: string;
  /** Subtítulo — usamos el titular de la nota. */
  description?: string;
  /** El request real. Solo se ejecuta si vence la ventana. */
  commit: () => Promise<unknown>;
  /** Deshace el estado optimista de la UI. Se llama al cancelar y al fallar. */
  revert: () => void;
  /** Corre después de un commit exitoso — típicamente `router.refresh()`. */
  onCommitted?: () => void;
  delayMs?: number;
};

export function scheduleDeferred(opts: ScheduleOptions) {
  const { key, message, description, commit, revert, onCommitted } = opts;
  const delayMs = opts.delayMs ?? DEFAULT_DELAY_MS;

  // Reprogramar la misma acción reemplaza la anterior sin ejecutarla dos veces.
  const existing = inflight.get(key);
  if (existing) {
    clearTimeout(existing.timer);
    toast.dismiss(existing.toastId);
    inflight.delete(key);
  }

  const toastId = toast(message, {
    description,
    duration: delayMs,
    action: {
      label: 'Deshacer',
      onClick: () => cancelDeferred(key),
    },
  });

  const timer = setTimeout(async () => {
    inflight.delete(key);
    announce();
    try {
      await commit();
      onCommitted?.();
    } catch (err) {
      revert();
      toast.error(
        err instanceof Error ? err.message : 'No se pudo completar la acción',
        { description }
      );
    }
  }, delayMs);

  inflight.set(key, { timer, toastId, commit, revert });
  announce();
}
