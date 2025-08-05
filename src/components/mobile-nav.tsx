
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/auth-context';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { NotificationBadge } from './ui/notification-badge';
import { 
  MessageSquare, ListChecks, HomeIcon, ListTodo, 
  Notebook, Calendar, Plus, Search,
  TrendingUp, Clock
} from 'lucide-react';
import { AddTaskButton } from './manage-tasks-sheet';
import { cn } from '@/lib/utils';

interface MobileNavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  isNew?: boolean;
}

export function MobileNav() {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();

  if (!isAuthenticated) {
    return null;
  }

  const navItems: MobileNavItem[] = [
    { label: 'Home', href: '/', icon: HomeIcon },
    { label: 'Notes', href: '/notes', icon: Notebook },
    { label: 'Chat', href: '/chat', icon: MessageSquare },
    { label: 'Pending', href: '/pending', icon: Clock, badge: 5 },
    { label: 'History', href: '/history', icon: TrendingUp },
  ];

  return (
    <>
      {/* Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 h-20 bg-background/98 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 border-t border-border/60">
        <div className="h-full px-2">
          <div className="grid h-full grid-cols-6 items-center gap-1">
            {navItems.map((item, index) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              
              return (
                <Button
                  key={item.href}
                  variant="ghost"
                  size="icon"
                  asChild
                  className={cn(
                    "h-16 w-full rounded-xl flex flex-col gap-1.5 py-2 relative transition-all duration-300 group",
                    isActive 
                      ? "bg-primary/10 text-primary shadow-sm" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Link href={item.href} className="flex flex-col items-center justify-center">
                    {/* Active indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="activeTabMobile"
                        className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-full"
                        initial={false}
                        transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
                      />
                    )}
                    
                    {/* Icon with badge */}
                    <div className="relative mb-1">
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          "p-2 rounded-lg transition-all duration-200",
                          isActive ? "bg-primary/20" : "group-hover:bg-muted/30"
                        )}
                      >
                        <Icon className={cn(
                          "h-5 w-5 transition-all duration-200",
                          isActive ? "text-primary" : "group-hover:text-foreground"
                        )} />
                      </motion.div>
                      
                      {/* Badge */}
                      {item.badge && (
                        <NotificationBadge 
                          count={item.badge}
                          className="absolute -top-1 -right-1 scale-90"
                          pulse={item.href === '/pending'}
                        />
                      )}
                      
                      {/* New indicator */}
                      {item.isNew && (
                        <div className="absolute -top-1 -right-1 h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
                      )}
                    </div>
                    
                    {/* Label */}
                    <span className={cn(
                      "text-xs font-medium transition-all duration-200 leading-tight",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )}>
                      {item.label}
                    </span>
                  </Link>
                </Button>
              );
            })}
            
            {/* Floating Add Button */}
            <div className="flex justify-center items-center">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative"
              >
                <AddTaskButton 
                  isMobile 
                  className={cn(
                    "h-14 w-14 rounded-2xl shadow-xl bg-gradient-to-br from-primary to-primary/80",
                    "hover:from-primary/90 hover:to-primary/70 border-2 border-background",
                    "transition-all duration-300 hover:shadow-2xl hover:shadow-primary/25"
                  )}
                >
                  <Plus className="h-6 w-6 text-primary-foreground" />
                </AddTaskButton>
                
                {/* Floating ring animation */}
                <motion.div
                  animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 0, 0.5]
                  }}
                  transition={{ 
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="absolute inset-0 rounded-2xl border-2 border-primary/30"
                />
              </motion.div>
            </div>
          </div>
          
          {/* Bottom safe area */}
          <div className="h-2 bg-background/50" />
        </div>
      </nav>
      
      {/* Safe area spacer */}
      <div className="lg:hidden h-20" />
    </>
  );
}
