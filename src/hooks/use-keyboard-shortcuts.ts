"use client";

import { useState, useEffect } from 'react';

interface KeyboardShortcut {
  key: string;
  modifiers: string[];
  description: string;
  category: 'navigation' | 'actions' | 'general';
}

interface ShortcutConfig {
  cmd: string;
  shift: string;
  alt: string;
  ctrl: string;
}

/**
 * Hook to detect operating system and provide appropriate keyboard shortcuts
 * Returns dynamic shortcuts that adapt to Windows/Mac conventions
 */
export function useKeyboardShortcuts() {
  const [isMac, setIsMac] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Detect operating system
    const detectOS = () => {
      if (typeof window !== 'undefined') {
        const userAgent = window.navigator.userAgent;
        const platform = window.navigator.platform;
        
        // Check for Mac
        const isMacOS = 
          /Mac|iPhone|iPad|iPod/.test(platform) ||
          /Mac OS X/.test(userAgent) ||
          /Macintosh/.test(userAgent);
        
        setIsMac(isMacOS);
        setIsLoading(false);
      }
    };

    detectOS();
  }, []);

  // Get the appropriate modifier keys based on OS
  const getModifiers = (): ShortcutConfig => {
    return {
      cmd: isMac ? '⌘' : 'Ctrl',
      shift: isMac ? '⇧' : 'Shift',
      alt: isMac ? '⌥' : 'Alt',
      ctrl: 'Ctrl'
    };
  };

  // Format shortcut string for display
  const formatShortcut = (modifiers: string[], key: string): string => {
    const mods = getModifiers();
    const formattedModifiers = modifiers.map(mod => {
      switch (mod.toLowerCase()) {
        case 'cmd':
        case 'meta':
          return mods.cmd;
        case 'shift':
          return mods.shift;
        case 'alt':
        case 'option':
          return mods.alt;
        case 'ctrl':
          return mods.ctrl;
        default:
          return mod;
      }
    });
    
    return `${formattedModifiers.join(' ')} ${key}`;
  };

  // Get primary modifier key for event handling
  const getPrimaryModifier = (): 'metaKey' | 'ctrlKey' => {
    return isMac ? 'metaKey' : 'ctrlKey';
  };

  // Navigation shortcuts
  const getNavigationShortcuts = () => [
    { key: 'D', modifiers: ['cmd'], description: 'Go to Dashboard', category: 'navigation' as const },
    { key: 'C', modifiers: ['cmd'], description: 'Go to Calendar', category: 'navigation' as const },
    { key: 'G', modifiers: ['cmd'], description: 'Go to Goals', category: 'navigation' as const },
    { key: 'N', modifiers: ['cmd'], description: 'Go to Notes', category: 'navigation' as const },
    { key: 'A', modifiers: ['cmd'], description: 'Go to Analytics', category: 'navigation' as const },
    { key: 'P', modifiers: ['cmd'], description: 'Go to Pending Tasks', category: 'navigation' as const },
    { key: 'H', modifiers: ['cmd'], description: 'Go to Completed Tasks', category: 'navigation' as const },
    { key: 'I', modifiers: ['cmd'], description: 'Go to AI Assistant', category: 'navigation' as const },
    { key: 'T', modifiers: ['cmd'], description: 'Go to Focus Timer', category: 'navigation' as const },
    { key: ',', modifiers: ['cmd'], description: 'Go to Settings', category: 'navigation' as const },
  ];

  // Action shortcuts
  const getActionShortcuts = () => [
    { key: 'K', modifiers: ['cmd'], description: 'Open Command Palette', category: 'actions' as const },
    { key: '/', modifiers: ['cmd'], description: 'Search', category: 'actions' as const },
    { key: 'N', modifiers: ['cmd', 'shift'], description: 'Add New Task', category: 'actions' as const },
    { key: 'T', modifiers: ['cmd', 'shift'], description: 'Change Theme', category: 'actions' as const },
    { key: '?', modifiers: ['cmd'], description: 'Show Keyboard Shortcuts', category: 'actions' as const },
  ];

  // General shortcuts
  const getGeneralShortcuts = () => [
    { key: 'Escape', modifiers: [], description: 'Close Modal/Dialog', category: 'general' as const },
    { key: 'Enter', modifiers: [], description: 'Submit Form', category: 'general' as const },
    { key: 'Tab', modifiers: [], description: 'Navigate Forward', category: 'general' as const },
    { key: 'Tab', modifiers: ['shift'], description: 'Navigate Backward', category: 'general' as const },
  ];

  // Get all shortcuts formatted for display
  const getAllShortcuts = () => {
    const navigation = getNavigationShortcuts().map(shortcut => ({
      ...shortcut,
      displayKey: formatShortcut(shortcut.modifiers, shortcut.key)
    }));

    const actions = getActionShortcuts().map(shortcut => ({
      ...shortcut,
      displayKey: formatShortcut(shortcut.modifiers, shortcut.key)
    }));

    const general = getGeneralShortcuts().map(shortcut => ({
      ...shortcut,
      displayKey: formatShortcut(shortcut.modifiers, shortcut.key)
    }));

    return {
      navigation,
      actions,
      general,
      all: [...navigation, ...actions, ...general]
    };
  };

  // Helper to check if a keyboard event matches a shortcut
  const matchesShortcut = (
    event: KeyboardEvent,
    modifiers: string[],
    key: string
  ): boolean => {
    const normalizedKey = key.toLowerCase();
    const eventKey = event.key.toLowerCase();

    // Check key match
    if (eventKey !== normalizedKey) return false;

    // Check modifiers
    const hasCmd = modifiers.includes('cmd') || modifiers.includes('meta');
    const hasShift = modifiers.includes('shift');
    const hasAlt = modifiers.includes('alt') || modifiers.includes('option');
    const hasCtrl = modifiers.includes('ctrl');

    const primaryMod = getPrimaryModifier();
    
    // Check primary modifier (Cmd on Mac, Ctrl on Windows)
    if (hasCmd && !event[primaryMod]) return false;
    if (!hasCmd && event[primaryMod]) return false;

    // Check other modifiers
    if (hasShift !== event.shiftKey) return false;
    if (hasAlt !== event.altKey) return false;
    if (hasCtrl !== event.ctrlKey) return false;

    return true;
  };

  return {
    isMac,
    isLoading,
    formatShortcut,
    getPrimaryModifier,
    getModifiers,
    getAllShortcuts,
    getNavigationShortcuts,
    getActionShortcuts,
    getGeneralShortcuts,
    matchesShortcut
  };
}

// Utility function to get OS-appropriate modifier symbols
export const getOSModifiers = () => {
  if (typeof window === 'undefined') {
    return { cmd: 'Ctrl', shift: 'Shift', alt: 'Alt', ctrl: 'Ctrl' };
  }

  const userAgent = window.navigator.userAgent;
  const platform = window.navigator.platform;
  
  const isMac = 
    /Mac|iPhone|iPad|iPod/.test(platform) ||
    /Mac OS X/.test(userAgent) ||
    /Macintosh/.test(userAgent);

  return {
    cmd: isMac ? '⌘' : 'Ctrl',
    shift: isMac ? '⇧' : 'Shift',
    alt: isMac ? '⌥' : 'Alt',
    ctrl: 'Ctrl'
  };
};
