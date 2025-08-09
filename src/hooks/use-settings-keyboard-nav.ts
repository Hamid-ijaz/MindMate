"use client";

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface UseSettingsKeyboardNavProps {
  selectedView: string;
  onSettingSelect: (settingId: string) => void;
  settings: any;
}

export function useSettingsKeyboardNav({ 
  selectedView, 
  onSettingSelect, 
  settings 
}: UseSettingsKeyboardNavProps) {
  const { toast } = useToast();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Get all available setting IDs
      const allSettingIds = ['overview'];
      Object.values(settings).forEach((category: any) => {
        category.settings.forEach((setting: any) => {
          allSettingIds.push(setting.id);
        });
      });

      const currentIndex = allSettingIds.indexOf(selectedView);

      // Handle keyboard navigation
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'k':
            event.preventDefault();
            // Focus search input
            const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
            if (searchInput) {
              searchInput.focus();
            }
            break;

          case 'h':
            event.preventDefault();
            // Go to overview/home
            onSettingSelect('overview');
            toast({
              title: "Navigated to Overview",
              description: "Use Ctrl+K to search settings",
              duration: 2000,
            });
            break;

          case 'p':
            event.preventDefault();
            // Go to profile
            onSettingSelect('profile');
            break;

          case 'n':
            event.preventDefault();
            // Go to notifications
            onSettingSelect('notifications');
            break;

          case 't':
            event.preventDefault();
            // Go to tasks
            onSettingSelect('tasks');
            break;

          case 'ArrowUp':
            event.preventDefault();
            // Navigate to previous setting
            if (currentIndex > 0) {
              onSettingSelect(allSettingIds[currentIndex - 1]);
            }
            break;

          case 'ArrowDown':
            event.preventDefault();
            // Navigate to next setting
            if (currentIndex < allSettingIds.length - 1) {
              onSettingSelect(allSettingIds[currentIndex + 1]);
            }
            break;
        }
      }

      // Handle Escape key
      if (event.key === 'Escape') {
        // Clear any focused search inputs
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement?.tagName === 'INPUT') {
          activeElement.blur();
        }
      }

      // Handle Tab navigation enhancement
      if (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey) {
        // Enhanced tab navigation could be added here
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Show keyboard shortcuts hint on first load
    const hasSeenKeyboardHint = localStorage.getItem('settings-keyboard-hint-seen');
    if (!hasSeenKeyboardHint) {
      setTimeout(() => {
        toast({
          title: "⌨️ Keyboard Shortcuts Available",
          description: "Press Ctrl+K to search, Ctrl+H for overview, and more!",
          duration: 4000,
        });
        localStorage.setItem('settings-keyboard-hint-seen', 'true');
      }, 2000);
    }

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedView, onSettingSelect, settings, toast]);

  // Return keyboard shortcut info for display
  return {
    shortcuts: [
      { key: 'Ctrl+K', description: 'Search settings' },
      { key: 'Ctrl+H', description: 'Go to Overview' },
      { key: 'Ctrl+P', description: 'Go to Profile' },
      { key: 'Ctrl+N', description: 'Go to Notifications' },
      { key: 'Ctrl+T', description: 'Go to Tasks' },
      { key: 'Ctrl+↑/↓', description: 'Navigate settings' },
      { key: 'Esc', description: 'Clear search' },
    ]
  };
}
