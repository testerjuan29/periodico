import { cn } from '@/lib/utils';
import { STATUS_LABEL, STATUS_COLOR, STATUS_SHORT, type Status } from '@/lib/statusLabels';

type Props = {
  status: string;
  short?: boolean;
  className?: string;
};

export function StatusBadge({ status, short = false, className }: Readonly<Props>) {
  const s = status as Status;
  const color = STATUS_COLOR[s] ?? STATUS_COLOR.pending;
  const label = short ? (STATUS_SHORT[s] ?? status) : (STATUS_LABEL[s] ?? status);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-label font-medium uppercase tracking-wider',
        color.bg,
        color.text,
        color.border,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', color.dot)} aria-hidden />
      {label}
    </span>
  );
}
