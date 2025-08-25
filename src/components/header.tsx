
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from './logo';
import { AddTaskButton } from './manage-tasks-sheet';
import { useAuth } from '@/contexts/auth-context';
import { useTasks } from '@/contexts/task-context';
import { useNotes } from '@/contexts/note-context';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';
import { NotificationBadge } from './ui/notification-badge';
import { 
  MessageSquare, ListChecks, HomeIcon, ListTodo, Settings, 
  Notebook, Calendar, Target, BarChart3, Menu, X,
  User, LogOut, Bell, Keyboard, ChevronDown, Plus,
  Zap, Search, Command as CommandIcon, Palette, BookOpen, Timer,
  TrendingUp, Activity, CheckCircle2, Clock, Globe, CheckSquare, StickyNote, Users
} from 'lucide-react';
import { ThemePicker } from './theme-picker';
import { ThemePickerDialog } from './theme-picker-dialog';
import { NotificationDropdown } from './notification-dropdown';
import { PWAInstallPrompt } from './pwa-install-prompt';
import { KeyboardShortcutsHelp } from './keyboard-shortcuts-help';
import { ClientOnly } from './ui/client-only';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuGroup
} from './ui/dropdown-menu';
import { 
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from './ui/navigation-menu';
import { 
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from './ui/command';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  shortcut?: string;
  description?: string;
  category: 'primary' | 'secondary' | 'tools' | 'admin';
}

interface QuickAction {
  label: string;
  action: () => void;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
}

export function Header() {
  const pathname = usePathname();
  const { isAuthenticated, user, logout, loading } = useAuth();
  const { setIsSheetOpen, tasks } = useTasks();
  const { notes } = useNotes();
  const { formatShortcut, getPrimaryModifier, matchesShortcut, getModifiers } = useKeyboardShortcuts();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (isMobileMenuOpen) {
      // Store current scroll position
      const scrollY = window.scrollY;
      
      // Lock body scroll and prevent scrolling
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      
      // Enhanced touch action prevention
      document.body.style.touchAction = 'none';
      (document.body.style as any).webkitOverflowScrolling = 'touch';
      
      // Prevent overscroll behavior
      document.body.style.overscrollBehavior = 'none';
      document.documentElement.style.overscrollBehavior = 'none';
      
      // Store scroll position to restore later
      document.body.dataset.scrollY = scrollY.toString();
      
      // Prevent default touch events on the document
      const preventTouchMove = (e: TouchEvent) => {
        // Allow scrolling within the mobile menu only
        const target = e.target as Element;
        const menuContainer = target.closest('[data-mobile-menu-content]');
        if (!menuContainer) {
          e.preventDefault();
        }
      };
      
      document.addEventListener('touchmove', preventTouchMove, { passive: false });
      
      return () => {
        document.removeEventListener('touchmove', preventTouchMove);
      };
    } else {
      // Restore scroll position
      const scrollY = document.body.dataset.scrollY;
      
      // Reset all styles
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.touchAction = '';
      (document.body.style as any).webkitOverflowScrolling = '';
      document.body.style.overscrollBehavior = '';
      document.documentElement.style.overscrollBehavior = '';
      
      // Restore scroll position
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY));
        delete document.body.dataset.scrollY;
      }
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.touchAction = '';
      (document.body.style as any).webkitOverflowScrolling = '';
      document.body.style.overscrollBehavior = '';
      document.documentElement.style.overscrollBehavior = '';
      if (document.body.dataset.scrollY) {
        const scrollY = document.body.dataset.scrollY;
        window.scrollTo(0, parseInt(scrollY));
        delete document.body.dataset.scrollY;
      }
    };
  }, [isMobileMenuOpen]);

  // Get OS-appropriate modifier keys
  const modifiers = getModifiers();

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const isAuthPage = pathname === '/login' || pathname === '/signup';

  // Enhanced navigation items with Calendar moved to secondary
  // Calculate actual pending tasks count
  const pendingCount = tasks ? tasks.filter(t => !t.completedAt && !t.parentId).length : 0;

  const navigationItems: NavItem[] = [
    // Primary workspace items
    { 
      label: 'Dashboard', 
      href: '/', 
      icon: HomeIcon, 
      category: 'primary',
      description: 'Overview of your tasks and progress'
    },
    { 
      label: 'Notes', 
      href: '/notes', 
      icon: Notebook, 
      category: 'primary',
      description: 'Capture ideas and information'
    },
    
    // Team collaboration items
    { 
      label: 'Teams', 
      href: '/teams', 
      icon: Users, 
      category: 'collaboration',
      description: 'Manage teams and workspaces'
    },
    { 
      label: 'Advanced Tasks', 
      href: '/advanced-tasks', 
      icon: CheckSquare, 
      category: 'collaboration',
      description: 'Templates, batch operations, and advanced search'
    },
    
    // Secondary workspace items with Calendar and Goals moved here
    { 
      label: 'Calendar', 
      href: '/calendar', 
      icon: Calendar, 
      category: 'secondary',
      description: 'Schedule and time management'
    },
    { 
      label: 'Goals', 
      href: '/goals', 
      icon: Target, 
      category: 'secondary',
      description: 'Track your objectives and milestones'
    },
    { 
      label: 'Analytics', 
      href: '/analytics', 
      icon: BarChart3, 
      category: 'secondary',
      description: 'Insights and performance metrics'
    },
    
    // Tools and utilities
    { 
      label: 'AI Assistant', 
      href: '/chat', 
      icon: MessageSquare, 
      category: 'tools',
      description: 'Get help and suggestions'
    },
    { 
      label: 'Focus Timer', 
      href: '/timer', 
      icon: Timer, 
      category: 'tools',
      description: 'Pomodoro and time tracking'
    },
    
    // Admin and management
    { 
      label: 'Pending Tasks', 
      href: '/pending', 
      icon: Clock, 
      badge: pendingCount, 
      category: 'admin',
      description: 'Review incomplete tasks'
    },
    { 
      label: 'Completed', 
      href: '/history', 
      icon: CheckCircle2, 
      category: 'admin',
      description: 'View completed tasks'
    },
  ];

  const primaryItems = navigationItems.filter(item => item.category === 'primary');
  const collaborationItems = navigationItems.filter(item => item.category === 'collaboration');
  const secondaryItems = navigationItems.filter(item => item.category === 'secondary');
  const toolsItems = navigationItems.filter(item => item.category === 'tools');
  const adminItems = navigationItems.filter(item => item.category === 'admin');

  // Quick actions for command palette
  const quickActions: QuickAction[] = [
    {
      label: 'Add New Task',
      action: () => setIsSheetOpen(true),
      icon: Plus
    },
    {
      label: 'Change Theme',
      action: () => setIsThemePickerOpen(true),
      icon: Palette
    },
    {
      label: 'Go to Pending Tasks',
      action: () => window.location.href = '/pending',
      icon: ListTodo
    },
    {
      label: 'Go to Completed Tasks',
      action: () => window.location.href = '/history',
      icon: CheckCircle2
    },
    {
      label: 'Open Settings',
      action: () => window.location.href = '/settings',
      icon: Settings
    },
  ];

  // Keyboard shortcuts with dynamic OS detection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command palette shortcuts
      if (matchesShortcut(e, ['cmd'], 'k') && !e.shiftKey) {
        e.preventDefault();
        setIsCommandOpen(true);
        return;
      }

      if (matchesShortcut(e, ['cmd'], '/')) {
        e.preventDefault();
        setIsCommandOpen(true);
        return;
      }

      // Action shortcuts
      if (matchesShortcut(e, ['cmd', 'shift'], 'N')) {
        e.preventDefault();
        setIsSheetOpen(true);
        return;
      }

      if (matchesShortcut(e, ['cmd', 'shift'], 'T')) {
        e.preventDefault();
        setIsThemePickerOpen(true);
        return;
      }

      // Navigation shortcuts
      if (matchesShortcut(e, ['cmd'], 'p')) {
        e.preventDefault();
        window.location.href = '/pending';
        return;
      }

      if (matchesShortcut(e, ['cmd'], 'h')) {
        e.preventDefault();
        window.location.href = '/history';
        return;
      }

      if (matchesShortcut(e, ['cmd'], 'd')) {
        e.preventDefault();
        window.location.href = '/';
        return;
      }

      if (matchesShortcut(e, ['cmd'], 'c')) {
        e.preventDefault();
        window.location.href = '/calendar';
        return;
      }

      if (matchesShortcut(e, ['cmd'], 'g')) {
        e.preventDefault();
        window.location.href = '/goals';
        return;
      }

      if (matchesShortcut(e, ['cmd'], 'n')) {
        e.preventDefault();
        window.location.href = '/notes';
        return;
      }

      if (matchesShortcut(e, ['cmd'], 'a')) {
        e.preventDefault();
        window.location.href = '/analytics';
        return;
      }

      if (matchesShortcut(e, ['cmd'], 'i')) {
        e.preventDefault();
        window.location.href = '/chat';
        return;
      }

      if (matchesShortcut(e, ['cmd'], 't') && !e.shiftKey) {
        e.preventDefault();
        window.location.href = '/timer';
        return;
      }

      if (matchesShortcut(e, ['cmd'], ',')) {
        e.preventDefault();
        window.location.href = '/settings';
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setIsSheetOpen, matchesShortcut]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const NavLink = ({ item, mobile = false, showDescription = false }: { 
    item: NavItem; 
    mobile?: boolean; 
    showDescription?: boolean;
  }) => {
    const isActive = pathname === item.href;
    const Icon = item.icon;
    
    return (
      <Button
        variant={isActive ? "secondary" : "ghost"}
        size={mobile ? "default" : "sm"}
        asChild
        className={cn(
          "relative transition-all duration-200 group",
          mobile ? "w-full justify-start h-12" : "h-9",
          isActive && !mobile ? "bg-secondary/80 text-secondary-foreground shadow-sm" : "",
          !isActive && "hover:bg-muted/50"
        )}
      >
        <Link href={item.href} onClick={() => mobile && setIsMobileMenuOpen(false)}>
          <div className="flex items-center gap-3 w-full">
            <div className="relative">
              <Icon className={cn(
                "transition-colors duration-200",
                mobile ? "h-5 w-5" : "h-4 w-4",
                isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
              )} />
              {item.badge && (
                <NotificationBadge 
                  count={item.badge}
                  className="absolute -top-2 -right-2 scale-75"
                  pulse={item.href === '/pending'}
                />
              )}
            </div>
            <div className="flex flex-col items-start flex-1">
              <span className={cn(
                "font-medium transition-colors duration-200",
                mobile ? "text-sm" : "text-sm",
                isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
              )}>
                {item.label}
              </span>
              {showDescription && item.description && (
                <span className="text-xs text-muted-foreground/70 mt-0.5">
                  {item.description}
                </span>
              )}
            </div>
          </div>
        </Link>
      </Button>
    );
  };

  const UserAvatar = ({ size = "sm" }: { size?: "sm" | "md" }) => (
    <div className={cn(
      "rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border-2 border-primary/10",
      size === "sm" ? "h-8 w-8" : "h-10 w-10"
    )}>
      <User className={cn(
        "text-primary",
        size === "sm" ? "h-4 w-4" : "h-5 w-5"
      )} />
    </div>
  );

  return (
    <ClientOnly>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          
          {/* Logo and Brand Section */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 group">
              <Logo />
            </Link>
            
            {isAuthenticated && (
              <div className="hidden xl:flex items-center gap-3">
                <div className="h-6 w-px bg-border" />
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/30">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm text-muted-foreground font-medium">
                    Welcome back, {user?.firstName || 'User'}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {isAuthenticated && (
              <>
                {/* Primary Navigation Items */}
                <div className="flex items-center gap-1">
                  {primaryItems.map((item) => (
                    <NavLink key={item.href} item={item} />
                  ))}
                </div>

                {/* Collaboration Items */}
                {collaborationItems.length > 0 && (
                  <div className="flex items-center gap-1">
                    {collaborationItems.map((item) => (
                      <NavLink key={item.href} item={item} />
                    ))}
                  </div>
                )}

                <div className="h-6 w-px bg-border mx-2" />

                {/* Navigation Menu for Secondary Items */}
                <NavigationMenu>
                  <NavigationMenuList>
                    <NavigationMenuItem>
                      <NavigationMenuTrigger className="gap-1 h-9 px-3">
                        <BarChart3 className="h-4 w-4" />
                        <span className="hidden sm:inline">More</span>
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <div className="w-[400px] p-4">
                          <div className="grid gap-4">
                            <div>
                              <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                                Workspace Tools
                              </h4>
                              <div className="grid gap-1">
                                {secondaryItems.map((item) => (
                                  <NavLink key={item.href} item={item} mobile showDescription />
                                ))}
                              </div>
                            </div>
                            
                            <div className="border-t pt-3">
                              <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                                AI & Productivity
                              </h4>
                              <div className="grid gap-1">
                                {toolsItems.map((item) => (
                                  <NavLink key={item.href} item={item} mobile showDescription />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </NavigationMenuContent>
                    </NavigationMenuItem>
                  </NavigationMenuList>
                </NavigationMenu>

                <div className="h-6 w-px bg-border mx-2" />

                {/* Admin Quick Access */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1 h-9 px-3 relative">
                      <Activity className="h-4 w-4" />
                      <span className="hidden sm:inline">Tasks</span>
                      {adminItems.some(item => item.badge) && (
                        <div className="absolute -top-1 -right-1 h-2 w-2 bg-destructive rounded-full animate-pulse" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>Task Management</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {adminItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <DropdownMenuItem key={item.href} asChild>
                          <Link href={item.href} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              <span>{item.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {item.badge && (
                                <NotificationBadge 
                                  count={item.badge}
                                  pulse={item.href === '/pending'}
                                />
                              )}
                            </div>
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-2">
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : isAuthenticated ? (
              <>
                {/* Command Palette Trigger */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCommandOpen(true)}
                  className="hidden md:flex gap-2 h-9 px-3 text-muted-foreground hover:text-foreground"
                >
                  <Search className="h-4 w-4" />
                  <span className="text-sm">Search</span>
                </Button>

                {/* Quick Add Button */}
                <div className="hidden sm:block">
                  <AddTaskButton />
                </div>

                {/* Utility Buttons */}
                <div className="flex items-center gap-1">
                  <div className="hidden md:block">
                    <PWAInstallPrompt />
                  </div>
                  <NotificationDropdown />
                </div>

                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2 px-2 h-9">
                      <UserAvatar />
                      <ChevronDown className="h-3 w-3 hidden sm:block" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel className="flex items-center gap-3 py-3">
                      <UserAvatar size="md" />
                      <div>
                        <p className="font-medium">{user?.firstName} {user?.lastName}</p>
                        <p className="text-sm text-muted-foreground">{user?.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuGroup>
                      <DropdownMenuItem asChild>
                        <Link href="/settings" className="flex items-center">
                          <Settings className="h-4 w-4 mr-2" />
                          Settings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setIsShortcutsHelpOpen(true)}>
                        <Keyboard className="h-4 w-4 mr-2" />
                        Keyboard Shortcuts
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Mobile Menu Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden h-9 w-9 p-0"
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                >
                  <motion.div
                    animate={{ rotate: isMobileMenuOpen ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {isMobileMenuOpen ? (
                      <X className="h-5 w-5" />
                    ) : (
                      <Menu className="h-5 w-5" />
                    )}
                  </motion.div>
                </Button>
              </>
            ) : (
              !isAuthPage && (
                <div className="flex items-center gap-2">
                  <ThemePicker />
                  <Button asChild className="h-9">
                    <Link href="/login">Sign In</Link>
                  </Button>
                </div>
              )
            )}
          </div>
        </div>

        {/* Enhanced Mobile Navigation Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && isAuthenticated && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="lg:hidden fixed inset-0 top-16 z-[60] bg-background border-t"
              style={{ minHeight: 'calc(100vh - 4rem)' }}
            >
              <div className="h-full flex flex-col min-h-0">
                <div 
                  data-mobile-menu-content
                  className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
                  style={{ 
                    touchAction: 'pan-y',
                    WebkitOverflowScrolling: 'touch',
                    overscrollBehavior: 'contain',
                    minHeight: 'calc(100vh - 4rem)'
                  }}
                >
                  <div className="container py-6 px-4 min-h-full">
                    <div className="space-y-6">
                      {/* Search Bar */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search anything..."
                          className="pl-10 h-11"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onFocus={() => setIsCommandOpen(true)}
                        />
                      </div>

                      {/* Quick Actions */}
                      <div className="flex gap-2">
                        <AddTaskButton className="flex-1" />
                        <Button variant="outline" size="default" className="px-6">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          AI Chat
                        </Button>
                      </div>

                      {/* Primary Navigation */}
                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-2">
                          Workspace
                        </h3>
                        <div className="space-y-1">
                          {primaryItems.map((item) => (
                            <NavLink key={item.href} item={item} mobile showDescription />
                          ))}
                        </div>
                      </div>

                      {/* Collaboration Navigation */}
                      {collaborationItems.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-2">
                            Team Collaboration
                          </h3>
                          <div className="space-y-1">
                            {collaborationItems.map((item) => (
                              <NavLink key={item.href} item={item} mobile showDescription />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Secondary Navigation */}
                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-2">
                          Tools & Analytics
                        </h3>
                        <div className="space-y-1">
                          {[...secondaryItems, ...toolsItems].map((item) => (
                            <NavLink key={item.href} item={item} mobile showDescription />
                          ))}
                        </div>
                      </div>

                      {/* Admin Navigation */}
                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-2">
                          Task Management
                        </h3>
                        <div className="space-y-1">
                          {adminItems.map((item) => (
                            <NavLink key={item.href} item={item} mobile showDescription />
                          ))}
                        </div>
                      </div>

                      {/* Mobile Utilities */}
                      <div className="pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <ThemePicker />
                            <PWAInstallPrompt />
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsShortcutsHelpOpen(true)}
                          >
                            <Keyboard className="h-4 w-4 mr-2" />
                            Shortcuts
                          </Button>
                        </div>
                      </div>
                      
                      {/* Bottom spacing for safe scrolling */}
                      <div className="h-8" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Enhanced Command Palette with Search */}
      <CommandDialog open={isCommandOpen} onOpenChange={setIsCommandOpen}>
        <CommandInput placeholder="Search tasks, notes, or type a command..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          
          <CommandGroup heading="Quick Actions">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <CommandItem
                  key={action.label}
                  onSelect={() => {
                    action.action();
                    setIsCommandOpen(false);
                  }}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  <span>{action.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
          
          <CommandSeparator />

          {/* Task Search Results */}
          {tasks && tasks.length > 0 && (
            <CommandGroup heading="Tasks">
              {tasks
                .filter(task => !task.completedAt)
                .slice(0, 8) // Limit results
                .map((task) => (
                  <CommandItem
                    key={task.id}
                    onSelect={() => {
                      window.location.href = `/task/${task.id}`;
                      setIsCommandOpen(false);
                    }}
                  >
                    <CheckSquare className="h-4 w-4 mr-2" />
                    <div className="flex flex-col">
                      <span className="font-medium">{task.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {task.category} • {task.priority} Priority • {task.duration}m
                      </span>
                    </div>
                  </CommandItem>
                ))}
            </CommandGroup>
          )}

          {/* Note Search Results */}
          {notes && notes.length > 0 && (
            <CommandGroup heading="Notes">
              {notes
                .slice(0, 6) // Limit results
                .map((note) => (
                  <CommandItem
                    key={note.id}
                    onSelect={() => {
                      window.location.href = `/notes?id=${note.id}`;
                      setIsCommandOpen(false);
                    }}
                  >
                    <StickyNote className="h-4 w-4 mr-2" />
                    <div className="flex flex-col">
                      <span className="font-medium">{note.title || 'Untitled Note'}</span>
                      <span className="text-xs text-muted-foreground">
                        {note.content ? note.content.substring(0, 50) + '...' : 'No content'}
                      </span>
                    </div>
                  </CommandItem>
                ))}
            </CommandGroup>
          )}

          <CommandSeparator />
          
          <CommandGroup heading="Navigation">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.href}
                  onSelect={() => {
                    window.location.href = item.href;
                    setIsCommandOpen(false);
                  }}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  <span>{item.label}</span>
                  {item.description && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {item.description}
                    </span>
                  )}
                  {item.shortcut && (
                    <CommandShortcut>{item.shortcut}</CommandShortcut>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp 
        open={isShortcutsHelpOpen} 
        onOpenChange={setIsShortcutsHelpOpen} 
      />

      {/* Theme Picker Dialog */}
      <ThemePickerDialog 
        open={isThemePickerOpen} 
        onOpenChange={setIsThemePickerOpen} 
      />
    </ClientOnly>
  );
}
