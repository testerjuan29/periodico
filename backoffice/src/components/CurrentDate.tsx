'use client';

import { useEffect, useState } from 'react';

// Reloj editorial visible en el header — refuerza la sensación de "cierre en curso".
export function CurrentDate() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!now) {
    return <span className="text-meta text-muted">—</span>;
  }

  const dateStr = now.toLocaleDateString('es-DO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('es-DO', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });

  return (
    <div className="flex items-baseline gap-3 whitespace-nowrap leading-tight">
      <span className="hidden text-label uppercase tracking-wider text-muted sm:inline">{dateStr}</span>
      <span className="font-mono text-lead font-semibold tabular-nums text-ink">{timeStr}</span>
    </div>
  );
}
