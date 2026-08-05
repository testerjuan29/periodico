'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { cn } from '@/lib/utils';

type Counts = { counts: Record<string, number>; active: number };

// Lanza en !ok para que SWR trate el 401 (sin sesión) como error y `data`
// quede undefined — sin esto, el body de error rompería el acceso a .counts.
const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

type Tab = {
  label: string;
  status: string | null;      // null = vista por defecto (activas)
  countKey?: string;          // omitido → sin contador
  tone?: 'pending' | 'schedule' | 'muted';
};

// 'Al aire' y 'Descartadas' no llevan contador a propósito: crecen sin techo y
// un número de tres cifras deja de comunicar nada.
const TABS: readonly Tab[] = [
  { label: 'Pendientes',      status: null,        countKey: 'pending',   tone: 'pending' },
  { label: 'En construcción', status: 'draft',     countKey: 'draft',     tone: 'muted' },
  { label: 'Programadas',     status: 'scheduled', countKey: 'scheduled', tone: 'schedule' },
  { label: 'Al aire',         status: 'published' },
  { label: 'Descartadas',     status: 'rejected' },
];

const TONE: Record<NonNullable<Tab['tone']>, string> = {
  pending:  'bg-pending text-white',
  schedule: 'bg-schedule text-white',
  muted:    'bg-muted/70 text-white',
};

export function NavTabs() {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get('status');

  const { data } = useSWR<Counts>('/api/publications/counts', fetcher, {
    refreshInterval: 15_000,
    revalidateOnFocus: true,
  });

  return (
    // Tabs píldora: la sección activa es un botón lleno, no un subrayado.
    <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
      {TABS.map((t) => {
        const href = t.status ? `/?status=${t.status}` : '/';
        const isOn = pathname === '/' && (current ?? null) === t.status;
        const n = t.countKey ? data?.counts?.[t.countKey] ?? 0 : 0;

        return (
          <Link
            key={t.label}
            href={href}
            className={cn(
              'inline-flex flex-none items-center gap-2 rounded-full px-3.5 py-1.5 text-meta font-medium transition-colors',
              isOn
                ? 'bg-ink text-paper'
                : 'text-muted hover:bg-subtle hover:text-ink'
            )}
          >
            {t.label}
            {t.countKey && n > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 font-mono text-micro font-semibold leading-[1.6] tabular-nums',
                  TONE[t.tone ?? 'muted']
                )}
              >
                {n}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
