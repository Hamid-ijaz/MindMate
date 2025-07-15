import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { TimeOfDay } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getCurrentTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return 'Morning';
  }
  if (hour >= 12 && hour < 18) {
    return 'Afternoon';
  }
  return 'Evening';
}
