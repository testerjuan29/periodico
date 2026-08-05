// Vocabulario editorial — reemplaza términos genéricos de admin dashboard
// por lenguaje de sala de redacción.

export type Status =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'partial'
  | 'failed'
  | 'rejected';

export const STATUS_LABEL: Record<Status, string> = {
  draft:      'En construcción',
  pending:    'Pendiente de cierre',
  approved:   'Aprobada',
  scheduled:  'Programada',
  publishing: 'En prensa',
  published:  'Al aire',
  partial:    'Parcialmente al aire',
  failed:     'Fallida',
  rejected:   'Descartada',
};

export const STATUS_SHORT: Record<Status, string> = {
  draft:      'En construcción',
  pending:    'Pendiente',
  approved:   'Aprobada',
  scheduled:  'Programada',
  publishing: 'En prensa',
  published:  'Al aire',
  partial:    'Parcial',
  failed:     'Falló',
  rejected:   'Descartada',
};

export const STATUS_COLOR: Record<Status, { bg: string; text: string; border: string; dot: string }> = {
  draft:      { bg: 'bg-subtle',        text: 'text-muted',    border: 'border-divider',     dot: 'bg-muted animate-pulse' },
  pending:    { bg: 'bg-pending-soft',  text: 'text-pending',  border: 'border-pending/30',  dot: 'bg-pending' },
  approved:   { bg: 'bg-approve-soft',  text: 'text-approve',  border: 'border-approve/30',  dot: 'bg-approve' },
  scheduled:  { bg: 'bg-schedule-soft', text: 'text-schedule', border: 'border-schedule/30', dot: 'bg-schedule' },
  publishing: { bg: 'bg-schedule-soft', text: 'text-schedule', border: 'border-schedule/30', dot: 'bg-schedule animate-pulse' },
  published:  { bg: 'bg-approve-soft',  text: 'text-approve',  border: 'border-approve/30',  dot: 'bg-approve' },
  partial:    { bg: 'bg-pending-soft',  text: 'text-pending',  border: 'border-pending/30',  dot: 'bg-pending' },
  failed:     { bg: 'bg-brand-soft',    text: 'text-brand',    border: 'border-brand/30',    dot: 'bg-brand' },
  rejected:   { bg: 'bg-subtle',        text: 'text-muted',    border: 'border-divider',     dot: 'bg-muted' },
};

// Regla vertical de color a la izquierda de cada fila del ledger.
// A diferencia del badge, esta se ve SIEMPRE (no solo en hover) — es la señal
// más escaneable de la lista y lo que permite juzgar la cola de un vistazo.
export const STATUS_RULE: Record<Status, string> = {
  draft:      'bg-muted/50',
  pending:    'bg-pending',
  approved:   'bg-approve',
  scheduled:  'bg-schedule',
  publishing: 'bg-schedule animate-pulse',
  published:  'bg-approve',
  partial:    'bg-pending',
  failed:     'bg-brand',
  rejected:   'bg-muted/40',
};

// Estados en los que la nota ya no admite decisión del editor.
export const SETTLED: ReadonlySet<string> = new Set([
  'publishing', 'published', 'partial', 'failed', 'rejected',
]);

// Vocabulario para acciones editoriales
export const ACTION_LABEL = {
  approve:  'Al aire ahora',
  schedule: 'Programar cierre',
  reject:   'Descartar',
  edit:     'Editar copy',
} as const;
