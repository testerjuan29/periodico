'use client';

import { cn } from '@/lib/utils';

// Timestamp editorial — importa en periodismo (deadline, cierre, hora de recepción).
// Usa tabular-nums (heredado del body) para alineación vertical impecable.
type Props = {
  date: string | Date;
  format?: 'time' | 'date' | 'datetime' | 'relative';
  className?: string;
};

const TIME_OPTS: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
const DATE_OPTS: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };

export function Timestamp({ date, format = 'time', className }: Readonly<Props>) {
  const d = typeof date === 'string' ? new Date(date) : date;

  const label = (() => {
    switch (format) {
      case 'time':     return d.toLocaleTimeString('es-DO', TIME_OPTS);
      case 'date':     return d.toLocaleDateString('es-DO', DATE_OPTS);
      case 'datetime': return d.toLocaleString('es-DO', { ...DATE_OPTS, ...TIME_OPTS });
      case 'relative': return relative(d);
    }
  })();

  const title = d.toLocaleString('es-DO', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });

  return (
    <time dateTime={d.toISOString()} title={title} className={cn('font-mono text-meta tabular-nums', className)}>
      {label}
    </time>
  );
}

function relative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const min  = Math.floor(diff / 60_000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr}h`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `hace ${days}d`;
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short' });
}
