const styles: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-900 border-yellow-300',
  approved:   'bg-blue-100 text-blue-900 border-blue-300',
  scheduled:  'bg-purple-100 text-purple-900 border-purple-300',
  publishing: 'bg-indigo-100 text-indigo-900 border-indigo-300',
  published:  'bg-green-100 text-green-900 border-green-300',
  partial:    'bg-orange-100 text-orange-900 border-orange-300',
  failed:     'bg-red-100 text-red-900 border-red-300',
  rejected:   'bg-gray-200 text-gray-700 border-gray-300',
};

const labels: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  scheduled: 'Programada',
  publishing: 'Publicando',
  published: 'Publicada',
  partial: 'Parcial',
  failed: 'Falló',
  rejected: 'Rechazada',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${styles[status] ?? styles.pending}`}>
      {labels[status] ?? status}
    </span>
  );
}
