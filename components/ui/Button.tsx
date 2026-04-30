import React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

// Editorial Cinematic CTA (DESIGN.md §4). 모든 variant는 pill, height 40-44px (Apple HIG 터치).
const buttonVariants = cva(
  'inline-flex items-center justify-center font-medium rounded-pill transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]',
  {
    variants: {
      variant: {
        primary:
          'bg-ink text-white hover:bg-canvas-deep dark:bg-white dark:text-ink dark:hover:bg-on-dark-soft',
        outline:
          'bg-transparent text-ink border border-hairline-strong hover:bg-ink/[0.04] dark:text-on-dark dark:border-white/20 dark:hover:bg-white/[0.06]',
        onDark:
          'bg-white text-ink hover:bg-on-dark-soft',
        text:
          'bg-transparent text-ink hover:underline underline-offset-4 dark:text-on-dark',
      },
      size: {
        sm: 'h-10 px-4 text-[14px]',
        md: 'h-11 px-5 text-[15px]',
        lg: 'h-14 px-7 text-[17px]',
        icon: 'h-11 w-11 p-0',
      },
      fullWidth: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, fullWidth, className }))}
      {...props}
    />
  )
);
Button.displayName = 'Button';

export { Button, buttonVariants };
