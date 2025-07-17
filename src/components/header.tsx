
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
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2 md:gap-6">
          <Link href="/">
            <Logo />
          </Link>
           {isAuthenticated && (
             <span className="text-sm text-muted-foreground hidden lg:inline">Welcome, {user?.firstName}</span>
           )}
        </div>
        
        <nav className="hidden md:flex flex-1 justify-center">
             {isAuthenticated && (
                <div className="flex items-center gap-2 sm:gap-4">
                     <Button variant="ghost" size="sm" asChild>
                        <Link href="/">
                        <HomeIcon className="mr-2 h-4 w-4" />
                        Home
                        </Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                        <Link href="/chat">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Check-in
                        </Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                        <Link href="/pending">
                        <ListTodo className="mr-2 h-4 w-4" />
                        Pending
                        </Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                        <Link href="/history">
                        <ListChecks className="mr-2 h-4 w-4" />
                        Completed
                        </Link>
                    </Button>
                </div>
            )}
        </nav>

        <div className="flex items-center gap-2 sm:gap-4 justify-end">
          {loading ? (
              <Skeleton className="h-8 w-24" />
          ) : isAuthenticated ? (
            <>
              <div className="md:hidden">
                <AddTaskButton />
              </div>
              <div className="hidden md:flex">
                 <AddTaskButton />
              </div>
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
      
       {isAuthenticated && (
         <nav className="md:hidden flex h-16 items-center justify-center border-t">
            <div className="flex items-center gap-2 sm:gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/">
                    <HomeIcon className="h-5 w-5" />
                    </Link>
                </Button>
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/chat">
                    <MessageSquare className="h-5 w-5" />
                    </Link>
                </Button>
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/pending">
                    <ListTodo className="h-5 w-5" />
                    </Link>
                </Button>
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/history">
                    <ListChecks className="h-5 w-5" />
                    </Link>
                </Button>
            </div>
        </nav>
      )}

    </header>
  );
}
