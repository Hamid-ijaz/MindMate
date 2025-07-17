
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from './logo';
import { AddTaskButton } from './manage-tasks-sheet';
import { useAuth } from '@/contexts/auth-context';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { MessageSquare, ListChecks, HomeIcon, ListTodo, Settings } from 'lucide-react';
import { ThemePicker } from './theme-picker';

export function Header() {
  const pathname = usePathname();
  const { isAuthenticated, user, logout, loading } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const isAuthPage = pathname === '/login' || pathname === '/signup';

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-7xl items-center">
        <div className="flex items-center gap-6 flex-1">
          <Link href="/">
            <Logo />
          </Link>
           {isAuthenticated && (
             <span className="text-sm text-muted-foreground hidden lg:inline">Welcome, {user?.firstName}</span>
           )}
        </div>
        
        <div className="flex-1 flex justify-center">
             {isAuthenticated && (
                <div className="flex items-center gap-2 sm:gap-4">
                     <Button variant="outline" size="sm" asChild>
                        <Link href="/">
                        <HomeIcon className="mr-0 sm:mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Home</span>
                        </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/chat">
                        <MessageSquare className="mr-0 sm:mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Check-in</span>
                        </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/pending">
                        <ListTodo className="mr-0 sm:mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Pending</span>
                        </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/history">
                        <ListChecks className="mr-0 sm:mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Completed</span>
                        </Link>
                    </Button>
                    <AddTaskButton />
                </div>
            )}
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-1 justify-end">
          {loading ? (
              <Skeleton className="h-8 w-24" />
          ) : isAuthenticated ? (
            <>
              <ThemePicker />
              <Button variant="ghost" size="icon" asChild>
                <Link href="/settings">
                  <Settings />
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>Logout</Button>
            </>
          ) : (
             !isAuthPage && (
                <>
                    <ThemePicker />
                    <Button asChild>
                        <Link href="/login">Login</Link>
                    </Button>
                </>
            )
          )}
        </div>
      </div>
    </header>
  );
}
