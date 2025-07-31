"use client";

import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface NotificationBadgeProps {
  count: number;
  max?: number;
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary';
  pulse?: boolean;
}

export function NotificationBadge({ 
  count, 
  max = 99, 
  className, 
  variant = 'destructive',
  pulse = true 
}: NotificationBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > max ? `${max}+` : count.toString();

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn("absolute -top-1 -right-1", className)}
    >
      <Badge 
        variant={variant}
        className={cn(
          "h-5 w-auto min-w-[20px] px-1 text-xs font-medium flex items-center justify-center",
          pulse && "animate-pulse",
          className
        )}
      >
        {displayCount}
      </Badge>
    </motion.div>
  );
}

export default NotificationBadge;
