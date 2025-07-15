
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from './logo';
import { ManageTasksSheet } from './manage-tasks-sheet';
import { useAuth } from '@/contexts/auth-context';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';

export function Header() {
  const pathname = usePathname();
  const { isAuthenticated, user, logout, loading } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const showAuthElements = !['/login', '/signup'].includes(pathname);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-7xl items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/">
            <Logo />
          </Link>
        </div>
        {showAuthElements && (
          <div className="flex items-center gap-4">
            {loading ? (
                <Skeleton className="h-8 w-24" />
            ) : isAuthenticated ? (
              <>
                <span className="text-sm text-muted-foreground hidden sm:inline">Welcome, {user?.email}</span>
                <ManageTasksSheet />
                <Button variant="ghost" size="sm" onClick={handleLogout}>Logout</Button>
              </>
            ) : (
                <Button asChild>
                    <Link href="/login">Login</Link>
                </Button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
