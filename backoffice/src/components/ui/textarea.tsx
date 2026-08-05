import * as React from 'react';
import { cn } from '@/lib/utils';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[80px] w-full rounded border border-divider bg-surface px-3 py-2 text-body text-ink placeholder:text-muted/70 transition-colors',
        'focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink',
        'disabled:cursor-not-allowed disabled:opacity-40',
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';
