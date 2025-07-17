
"use client";

import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Button } from './ui/button';
import { MessageSquare, ListChecks, HomeIcon, ListTodo } from 'lucide-react';
import { AddTaskButton } from './manage-tasks-sheet';

export function MobileNav() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t">
      <div className="grid h-full grid-cols-5 items-center">
        <Button variant="ghost" size="icon" asChild className="h-full w-full rounded-none">
          <Link href="/">
            <HomeIcon className="h-5 w-5" />
            <span className="sr-only">Home</span>
          </Link>
        </Button>
        <Button variant="ghost" size="icon" asChild className="h-full w-full rounded-none">
          <Link href="/chat">
            <MessageSquare className="h-5 w-5" />
            <span className="sr-only">Chat</span>
          </Link>
        </Button>
        <div className="flex justify-center items-center">
             <AddTaskButton isMobile />
        </div>
        <Button variant="ghost" size="icon" asChild className="h-full w-full rounded-none">
          <Link href="/pending">
            <ListTodo className="h-5 w-5" />
            <span className="sr-only">Pending</span>
          </Link>
        </Button>
        <Button variant="ghost" size="icon" asChild className="h-full w-full rounded-none">
          <Link href="/history">
            <ListChecks className="h-5 w-5" />
            <span className="sr-only">Completed</span>
          </Link>
        </Button>
      </div>
    </nav>
  );
}
