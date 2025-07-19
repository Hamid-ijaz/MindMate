"use client";

import { useSetupNotificationHandlers } from '@/hooks/use-notification-handlers';

export function ClientWrapper({ children }: { children: React.ReactNode }) {
  useSetupNotificationHandlers();
  return <>{children}</>;
} 