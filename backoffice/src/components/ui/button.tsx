import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded font-medium transition-all disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
  {
    variants: {
      variant: {
        // Disabled tiene su propio contraste, no opacity-40 (que borra el texto sobre bg oscuro)
        primary:     'bg-ink text-paper hover:bg-ink/90 active:bg-ink shadow-card disabled:bg-subtle disabled:text-muted disabled:shadow-none',
        critical:    'bg-brand text-white hover:bg-brand-dark active:bg-brand-dark shadow-card disabled:bg-brand/40 disabled:text-white/70 disabled:shadow-none',
        approve:     'bg-approve text-white hover:bg-approve/90 shadow-card disabled:bg-approve/40 disabled:text-white/70 disabled:shadow-none',
        outline:     'border border-divider bg-transparent text-ink hover:bg-subtle hover:border-ink/20 disabled:text-muted disabled:border-divider',
        ghost:       'bg-transparent text-ink hover:bg-subtle disabled:text-muted',
        link:        'text-schedule underline-offset-4 hover:underline p-0 h-auto disabled:text-muted disabled:no-underline',
      },
      size: {
        sm:      'h-8 px-3 text-meta',
        default: 'h-10 px-4 text-body',
        lg:      'h-12 px-6 text-lead',
        icon:    'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size:    'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { buttonVariants };
