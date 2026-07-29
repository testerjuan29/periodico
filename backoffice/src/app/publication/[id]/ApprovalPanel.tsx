'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  id: string;
  status: string;
  scheduledAt: Date | null;
};

export function ApprovalPanel({ id, status, scheduledAt }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [schedule, setSchedule] = useState(
    scheduledAt ? new Date(scheduledAt).toISOString().slice(0, 16) : ''
  );
  const [reason, setReason] = useState('');

  const isFinal = ['published', 'rejected', 'failed'].includes(status);

  const call = (action: 'approve' | 'schedule' | 'reject') => {
    startTransition(async () => {
      const res = await fetch(`/api/publications/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: schedule, reason }),
      });
      if (!res.ok) {
        alert(`Error: ${await res.text()}`);
        return;
      }
      router.refresh();
    });
  };

  if (isFinal) {
    return (
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="mb-3 font-semibold">Estado final</h3>
        <p className="text-sm text-gray-600">
          Esta publicación ya fue procesada. Revisa el historial para más detalles.
        </p>
      </div>
    );
  }

  return (
    <div className="sticky top-6 space-y-4 rounded-lg border bg-white p-6 shadow-sm">
      <h3 className="font-semibold">Acciones del editor</h3>

      <button
        onClick={() => call('approve')}
        disabled={pending}
        className="w-full rounded bg-brand px-4 py-3 font-semibold text-white shadow hover:bg-brand-dark disabled:opacity-50"
      >
        Aprobar y publicar ahora
      </button>

      <div className="border-t pt-4">
        <label className="mb-2 block text-sm font-medium">Programar publicación</label>
        <input
          type="datetime-local"
          value={schedule}
          onChange={(e) => setSchedule(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
        />
        <button
          onClick={() => call('schedule')}
          disabled={pending || !schedule}
          className="mt-2 w-full rounded border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand hover:text-white disabled:opacity-50"
        >
          Programar
        </button>
      </div>

      <div className="border-t pt-4">
        <label className="mb-2 block text-sm font-medium">Rechazar</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo (opcional)"
          className="w-full rounded border px-3 py-2 text-sm"
          rows={2}
        />
        <button
          onClick={() => call('reject')}
          disabled={pending}
          className="mt-2 w-full rounded border border-gray-400 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          Rechazar
        </button>
      </div>
    </div>
  );
}
