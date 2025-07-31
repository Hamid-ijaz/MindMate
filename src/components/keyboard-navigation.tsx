"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface KeyboardNavigationProps {
  isEnabled?: boolean;
}

export function KeyboardNavigation({ isEnabled = true }: KeyboardNavigationProps) {
  const router = useRouter();

  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when no input is focused
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        (event.target as HTMLElement)?.contentEditable === 'true'
      ) {
        return;
      }

      // Handle navigation shortcuts with Alt key
      if (event.altKey && !event.ctrlKey && !event.shiftKey) {
        let path: string | null = null;

        switch (event.key) {
          case '1':
            path = '/';
            break;
          case '2':
            path = '/calendar';
            break;
          case '3':
            path = '/goals';
            break;
          case '4':
            path = '/notes';
            break;
          case '5':
            path = '/analytics';
            break;
          case '6':
            path = '/pending';
            break;
          case '7':
            path = '/history';
            break;
          case '8':
            path = '/chat';
            break;
          case '9':
            path = '/settings';
            break;
        }

        if (path) {
          event.preventDefault();
          router.push(path);
        }
      }

      // Handle other shortcuts
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'k':
            // This could trigger a search or command palette
            event.preventDefault();
            // You can add a search modal trigger here
            break;
          case 'n':
            // Quick add task
            event.preventDefault();
            // Trigger add task modal
            document.querySelector('[data-add-task-trigger]')?.click();
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isEnabled, router]);

  return null;
}

export default KeyboardNavigation;
