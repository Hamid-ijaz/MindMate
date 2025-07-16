
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from './logo';
import { ManageTasksSheet } from './manage-tasks-sheet';
import { useAuth } from '@/contexts/auth-context';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { MessageSquare, ListChecks } from 'lucide-react';

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
      <div className="container flex h-16 max-w-7xl items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/">
            <Logo />
          </Link>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4">
          {loading ? (
              <Skeleton className="h-8 w-24" />
          ) : isAuthenticated ? (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline">Welcome, {user?.email}</span>
               <Button variant="outline" size="sm" asChild>
                <Link href="/chat">
                  <MessageSquare className="mr-0 sm:mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Check-in</span>
                </Link>
              </Button>
               <Button variant="outline" size="sm" asChild>
                <Link href="/history">
                  <ListChecks className="mr-0 sm:mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">History</span>
                </Link>
              </Button>
              <ManageTasksSheet />
              <Button variant="ghost" size="sm" onClick={handleLogout}>Logout</Button>
            </>
          ) : (
             !isAuthPage && (
                <Button asChild>
                    <Link href="/login">Login</Link>
                </Button>
            )
          )}
        </div>
      </div>
    </header>
  );
}
