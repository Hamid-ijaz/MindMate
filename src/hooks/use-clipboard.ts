"use client";

import { useState, useCallback, useEffect } from 'react';
import { copyToClipboard, isClipboardSupported } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export function useClipboard() {
  const [isCopied, setIsCopied] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsMounted(true);
    setIsSupported(isClipboardSupported());
  }, []);

  const copy = useCallback(async (text: string) => {
    if (!isMounted || !isSupported) {
      toast({
        title: "Clipboard Not Supported",
        description: "Your browser doesn't support copying to clipboard. Please copy manually.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const success = await copyToClipboard(text);
      if (success) {
        setIsCopied(true);
        toast({
          title: "Copied!",
          description: "Text copied to clipboard",
        });
        setTimeout(() => setIsCopied(false), 2000);
        return true;
      } else {
        toast({
          title: "Copy Failed",
          description: "Failed to copy to clipboard. Please try again.",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error('Clipboard copy error:', error);
      toast({
        title: "Copy Failed",
        description: "An error occurred while copying to clipboard.",
        variant: "destructive",
      });
      return false;
    }
  }, [toast, isMounted, isSupported]);

  return {
    copy,
    isCopied,
    isSupported: isMounted && isSupported,
  };
} 