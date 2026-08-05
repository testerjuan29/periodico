'use client';

import { useEffect, useState } from 'react';
import { Check, Clock, X, Pencil, Circle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Timestamp } from '@/components/Timestamp';
import { cn } from '@/lib/utils';

type AuditEntry = {
  id: string;
  action: string;
  actorEmail: string | null;
  createdAt: string;
  payload: Record<string, unknown> | null;
};

const ACTION_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  approve:  { label: 'Aprobada',   icon: Check,  color: 'text-approve' },
  schedule: { label: 'Programada', icon: Clock,  color: 'text-schedule' },
  reject:   { label: 'Descartada', icon: X,      color: 'text-muted' },
  edit:     { label: 'Editada',    icon: Pencil, color: 'text-pending' },
};

export function AuditTimeline({ publicationId }: Readonly<{ publicationId: string }>) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/publications/${publicationId}/audit`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setEntries(data.entries ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [publicationId]);

  if (loading) {
    return (
      <Card className="p-5">
        <div className="text-label uppercase tracking-wider text-muted">Bitácora</div>
        <div className="mt-3 h-4 w-2/3 rounded bg-subtle animate-pulse" />
      </Card>
    );
  }

  if (entries.length === 0) return null;

  return (
    <Card className="p-5">
      <h3 className="mb-4 text-label font-semibold uppercase tracking-wider text-muted">
        Bitácora
      </h3>
      <ol className="space-y-4">
        {entries.map((e, idx) => {
          const meta = ACTION_META[e.action] ?? { label: e.action, icon: Circle, color: 'text-muted' };
          const Icon = meta.icon;
          const scheduledAt =
            e.payload && typeof (e.payload as Record<string, unknown>).scheduledAt === 'string'
              ? new Date((e.payload as Record<string, string>).scheduledAt)
              : null;
          const reason =
            e.payload && typeof (e.payload as Record<string, unknown>).reason === 'string'
              ? ((e.payload as Record<string, string>).reason as string)
              : null;
          const changed =
            e.payload && Array.isArray((e.payload as Record<string, unknown>).changed)
              ? ((e.payload as Record<string, string[]>).changed as string[])
              : null;

          const isLast = idx === entries.length - 1;

          return (
            <li key={e.id} className="relative flex gap-3">
              {/* Línea vertical del timeline */}
              {!isLast && (
                <span aria-hidden className="absolute left-[11px] top-6 h-full w-px bg-divider" />
              )}
              <div className={cn('flex-none rounded-full border border-divider bg-surface p-1', meta.color)}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1 pb-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={cn('font-medium text-meta', meta.color)}>{meta.label}</span>
                  <Timestamp date={e.createdAt} format="relative" className="text-label text-muted" />
                </div>
                <div className="mt-0.5 text-label text-muted">
                  {e.actorEmail ?? 'sistema'}
                </div>
                {scheduledAt && (
                  <div className="mt-1 text-label text-muted">
                    Para: <Timestamp date={scheduledAt} format="datetime" className="text-label text-ink" />
                  </div>
                )}
                {reason && (
                  <div className="mt-1 rounded border-l-2 border-divider pl-2 text-label italic text-muted">
                    "{reason}"
                  </div>
                )}
                {changed && changed.length > 0 && (
                  <div className="mt-1 text-label text-muted">
                    Campos: <span className="font-mono">{changed.join(', ')}</span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
