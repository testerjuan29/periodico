import { cn } from '@/lib/utils';

// Guiño intencional al nombre PaginaUno.Do — cada card se numera P1, P2, P3...
// como si fuera la página del diario donde va a ir.
export function PageNumber({ n, className }: Readonly<{ n: number; className?: string }>) {
  return (
    <span
      className={cn(
        'font-mono text-label font-semibold tracking-wide text-muted transition-colors group-hover:text-brand',
        className
      )}
    >
      P{n}
    </span>
  );
}
