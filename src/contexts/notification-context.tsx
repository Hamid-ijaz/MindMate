
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { useTasks } from './task-context';

type NotificationPermission = 'default' | 'granted' | 'denied';

interface NotificationOptions {
    body?: string;
    tag?: string;
    data?: any;
    actions?: {
        onComplete?: (taskId: string) => void;
    }
}

interface NotificationContextType {
  permission: NotificationPermission;
  requestPermission: () => void;
  sendNotification: (title: string, options?: NotificationOptions) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const { toast } = useToast();
  
  useEffect(() => {
    // Ensure this runs only on the client
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const playNotificationSound = () => {
    const audio = new Audio('/audio/notification.wav');
    audio.play().catch(error => console.error("Failed to play notification sound:", error));
  };

  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (typeof window === 'undefined') return;

    playNotificationSound();

    const { dismiss } = toast({
      title: title,
      description: options?.body,
      duration: 30000, // Keep it on screen longer
      action: (
        <div className="flex flex-col gap-2">
            {options?.data?.taskId && options?.actions?.onComplete && (
                 <Button size="sm" onClick={() => {
                    options.actions!.onComplete!(options.data.taskId);
                    dismiss();
                 }}>
                    Complete
                </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => dismiss()}>
                Dismiss
            </Button>
        </div>
      ),
    });
  }, [toast]);


  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast({
        title: "Notifications Not Supported",
        description: "Your browser does not support notifications.",
        variant: "destructive",
      });
      return;
    }

    const status = await Notification.requestPermission();
    setPermission(status);

    if (status === 'granted') {
      toast({
        title: "Notifications Enabled!",
        description: "You'll now receive reminders.",
      });
      // Test notification
      new Notification("MindMate", { body: "You're all set up for notifications!" });
    } else if (status === 'denied') {
      toast({
        title: "Notifications Blocked",
        description: "To enable them, you'll need to go to your browser settings.",
        variant: "destructive",
      });
    }
  }, [toast]);

  return (
    <NotificationContext.Provider value={{ permission, requestPermission, sendNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
