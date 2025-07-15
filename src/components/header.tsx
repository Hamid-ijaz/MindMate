"use client";

import Link from 'next/link';
import { Logo } from './logo';
import { ManageTasksSheet } from './manage-tasks-sheet';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-7xl items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/">
            <Logo />
          </Link>
        </div>
        <div className="flex items-center gap-2">
           <ManageTasksSheet />
        </div>
      </div>
    </header>
  );
}
