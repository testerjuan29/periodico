'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Search, X, MessageCircle, Mail } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: 'active',     label: 'En edición · activas' },
  { value: 'all',        label: 'Todos los estados' },
  { value: 'draft',      label: 'En construcción (WhatsApp)' },
  { value: 'pending',    label: 'Pendientes de cierre' },
  { value: 'approved',   label: 'Aprobadas' },
  { value: 'scheduled',  label: 'Programadas' },
  { value: 'publishing', label: 'En prensa' },
  { value: 'published',  label: 'Al aire' },
  { value: 'partial',    label: 'Parcialmente al aire' },
  { value: 'failed',     label: 'Fallidas' },
  { value: 'rejected',   label: 'Descartadas' },
];

// La fuente son solo tres valores: chips de un click le ganan a un dropdown.
const SOURCE_CHIPS = [
  { value: 'all',      label: 'Todas',    icon: null },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'email',    label: 'Email',    icon: Mail },
] as const;

export function DashboardFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');

  useEffect(() => {
    const current = params.get('q') ?? '';
    if (q === current) return;
    const t = setTimeout(() => updateParam('q', q), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value && value !== 'active' && value !== 'all') next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    const s = next.toString();
    router.push(s ? `/?${s}` : '/');
  };

  const statusValue = params.get('status') ?? 'active';
  const sourceValue = params.get('source') ?? 'all';

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar en títulos, textos, remitentes…"
          className={cn(
            'h-9 w-full rounded-md border border-divider bg-surface pl-9 pr-8 text-meta text-ink',
            'placeholder:text-muted/70 transition-colors',
            'focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink'
          )}
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted hover:bg-subtle hover:text-ink"
            aria-label="Limpiar búsqueda"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1">
        {SOURCE_CHIPS.map((c) => {
          const on = sourceValue === c.value;
          const Icon = c.icon;
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => updateParam('source', c.value)}
              aria-pressed={on}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-label font-medium transition-all',
                on
                  ? 'border-divider bg-surface font-semibold text-ink shadow-card'
                  : 'border-transparent text-muted hover:bg-subtle hover:text-ink'
              )}
            >
              {Icon && <Icon className="h-3 w-3" />}
              {c.label}
            </button>
          );
        })}

        {/* Select fantasma: presente sin pelear por atención */}
        <div className="ml-auto">
          <Select value={statusValue} onValueChange={(v) => updateParam('status', v)}>
            <SelectTrigger
              className="h-7 w-auto gap-1 border-0 bg-transparent px-2 text-label text-muted shadow-none hover:bg-subtle hover:text-ink focus:ring-0"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
