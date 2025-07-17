
"use client";

import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Button } from './ui/button';
import { MessageSquare, ListChecks, HomeIcon, ListTodo } from 'lucide-react';

export function MobileNav() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-center border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
  );
}
