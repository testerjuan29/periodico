import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded border border-divider bg-surface px-3 py-2 text-body text-ink placeholder:text-muted/70 transition-colors',
        'focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink',
        'disabled:cursor-not-allowed disabled:opacity-40',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';
