"use client";

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  children: React.ReactNode;
}

export const Icon = forwardRef<SVGSVGElement, IconProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <svg
        ref={ref}
        className={cn("", className)}
        {...props}
        suppressHydrationWarning
      >
        {children}
      </svg>
    );
  }
);

Icon.displayName = "Icon"; 