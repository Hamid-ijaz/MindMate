"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Keyboard, Command, Option, Monitor, Apple } from 'lucide-react';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  const { getAllShortcuts, isMac, isLoading } = useKeyboardShortcuts();

  if (isLoading) {
    return null; // Or a loading spinner
  }

  const shortcuts = getAllShortcuts();

  const KeyBadge = ({ shortcut }: { shortcut: string }) => {
    const keys = shortcut.split(' ');
    return (
      <div className="flex items-center gap-1">
        {keys.map((key, index) => (
          <span key={index} className="flex items-center">
            <Badge variant="outline" className="px-2 py-1 text-xs font-mono">
              {key}
            </Badge>
            {index < keys.length - 1 && <span className="mx-1 text-muted-foreground">+</span>}
          </span>
        ))}
      </div>
    );
  };

  const ShortcutSection = ({ 
    title, 
    description, 
    shortcuts: sectionShortcuts 
  }: { 
    title: string; 
    description: string; 
    shortcuts: Array<{ displayKey: string; description: string }>;
  }) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sectionShortcuts.map((shortcut, index) => (
            <motion.div
              key={`${shortcut.displayKey}-${shortcut.description}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center justify-between py-2"
            >
              <span className="text-sm">{shortcut.description}</span>
              <KeyBadge shortcut={shortcut.displayKey} />
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
            <div className="flex items-center gap-1 ml-auto">
              {isMac ? (
                <Apple className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Monitor className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-sm text-muted-foreground">
                {isMac ? 'macOS' : 'Windows'}
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="text-sm text-muted-foreground">
            Use these keyboard shortcuts to navigate faster and boost your productivity. 
            Shortcuts automatically adapt to your operating system.
          </div>

          <ShortcutSection
            title="Navigation"
            description="Quickly jump between different sections of the app"
            shortcuts={shortcuts.navigation}
          />

          <ShortcutSection
            title="Actions"
            description="Perform common actions without using the mouse"
            shortcuts={shortcuts.actions}
          />

          <ShortcutSection
            title="General"
            description="Universal shortcuts that work throughout the app"
            shortcuts={shortcuts.general}
          />

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-xs text-muted-foreground">
              {isMac ? '⌘ = Command key' : 'Ctrl = Control key'}
            </div>
            <Button onClick={() => onOpenChange(false)}>
              Got it!
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
