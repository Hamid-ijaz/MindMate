import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getCurrentTimeOfDay(): 'Morning' | 'Afternoon' | 'Evening' | 'Night' {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 21) return 'Evening';
  return 'Night';
}

export function getDefaultPriority(): 'Low' | 'Medium' | 'High' | 'Critical' {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'High';
  if (hour >= 12 && hour < 18) return 'Critical';
  if (hour >= 18 && hour < 22) return 'Medium';
  return 'Low';
}

/**
 * Safely copy text to clipboard with fallback support
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  try {
    // Modern clipboard API (only in secure contexts)
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback for older browsers or non-secure contexts
    if (typeof document !== 'undefined') {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
      } catch (err) {
        document.body.removeChild(textArea);
        return false;
      }
    }
    
    return false;
  } catch (err) {
    console.warn('Clipboard copy failed:', err);
    return false;
  }
}

/**
 * Check if clipboard API is supported
 */
export function isClipboardSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  return !!(navigator.clipboard && window.isSecureContext);
}

/**
 * Safely create a Date object from a timestamp or date value
 */
export function safeDate(value?: number | string | Date): Date | null {
  if (!value) return null;
  
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      console.warn('Invalid date value:', value);
      return null;
    }
    return date;
  } catch (error) {
    console.error('Date creation error:', error);
    return null;
  }
}

/**
 * Safely format a date with fallback
 */
export function safeDateFormat(value?: number | string | Date, formatStr: string = "MMM d, yyyy", fallback: string = "Invalid date"): string {
  const date = safeDate(value);
  if (!date) return fallback;
  
  try {
    const { format } = require('date-fns');
    return format(date, formatStr);
  } catch (error) {
    console.error('Date formatting error:', error);
    return fallback;
  }
}

/**
 * Check if a task is overdue based on reminderAt date
 */
export function isTaskOverdue(reminderAt?: number | string | Date): boolean {
  if (!reminderAt) return false;
  
  const reminderDate = safeDate(reminderAt);
  if (!reminderDate) return false;
  
  const now = new Date();
  return reminderDate < now;
}
