'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { useAuth } from './auth-context';
import { notificationService } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import type { NotificationDocument, NotificationData } from '@/lib/types';

interface UnifiedNotificationContextType {
  // Data
  notifications: NotificationDocument[];
  unreadCount: number;
  isLoading: boolean;
  
  // Actions
  sendInAppNotification: (
    title: string, 
    body: string, 
    data?: NotificationData
  ) => Promise<string | null>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  
  // Permission and settings
  permission: NotificationPermission;
  requestPermission: () => Promise<void>;
  
  // Stats
  refreshStats: () => Promise<void>;
}

const UnifiedNotificationContext = createContext<UnifiedNotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export const UnifiedNotificationProvider = ({ children }: NotificationProviderProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<NotificationDocument[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const displayedNotificationsRef = useRef<Set<string>>(new Set());
  const dismissedNotificationsRef = useRef<Set<string>>(new Set());
  const getDismissedKey = (email?: string) => `mindmate-dismissed-toasts:${email ?? 'anon'}`;
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Initialize permission state
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Set up real-time subscription when user is available
  useEffect(() => {
    // initialize dismissed set from localStorage (scoped per user)
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(getDismissedKey(user?.email));
        if (raw) {
          const arr = JSON.parse(raw) as string[];
          dismissedNotificationsRef.current = new Set(arr || []);
        }
      } catch (error) {
        console.warn('Failed to read dismissed toasts from localStorage', error);
      }
    }

    if (!user?.email) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setIsLoading(true);

    // Subscribe to real-time notifications
    const unsubscribe = notificationService.subscribeToNotifications(
      user.email,
      (newNotifications) => {
        setNotifications(newNotifications);
        setUnreadCount(newNotifications.filter(n => !n.isRead).length);
        setIsLoading(false);
        
        // Show toast notifications for new unread notifications
        newNotifications.forEach(notif => {
          // skip if already displayed in this session or dismissed by user
          if (
            !notif.isRead &&
            !displayedNotificationsRef.current.has(notif.id) &&
            !dismissedNotificationsRef.current.has(notif.id)
          ) {
            displayedNotificationsRef.current.add(notif.id);

            const persistDismiss = (id: string) => {
              try {
                dismissedNotificationsRef.current.add(id);
                localStorage.setItem(
                  getDismissedKey(user?.email),
                  JSON.stringify(Array.from(dismissedNotificationsRef.current))
                );
              } catch (error) {
                console.warn('Failed to persist dismissed toast id', error);
              }
            };

            const { dismiss } = toast({
              title: `🔔 ${notif.title}`,
              description: notif.body,
              duration: 5000,
              action: (
                <Button size="sm" onClick={() => { dismiss(); persistDismiss(notif.id); }}>
                  Dismiss
                </Button>
              ),
            });
          }
        });
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      unsubscribe();
      unsubscribeRef.current = null;
    };
  }, [user?.email, toast]);

  // Clean up subscription on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // Listen for messages from the service worker (e.g. notification click)
  // When SW posts { type: 'NAVIGATE_TO_TASK', taskId }, mark related notifications as read
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const handler = async (event: MessageEvent) => {
      try {
        const data = event?.data;
        if (!data || data.type !== 'NAVIGATE_TO_TASK') return;

        const taskId = data.taskId;
        if (!taskId || !user?.email) return;

        // Fetch recent notifications and mark any unread notifications related to this task as read
        const allNotifs = await notificationService.getNotifications(user.email, 200);
        const related = allNotifs.filter(n => (
          n.relatedTaskId === taskId || n.data?.taskId === taskId
        ) && !n.isRead);

        await Promise.all(related.map(n => notificationService.markAsRead(user.email, n.id)));
      } catch (err) {
        console.error('Failed to process service worker message for notifications:', err);
      }
    };

    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [user?.email]);

  // If the user opens the app directly at /task/:id (for example from SW openWindow),
  // mark related notifications read on initial load as a fallback.
  useEffect(() => {
    try {
      if (typeof window === 'undefined' || !user?.email) return;
      const path = window.location.pathname || '';
      const match = path.match(/^\/task\/(.+)/);
      const taskId = match ? match[1] : null;
      if (!taskId) return;

      (async () => {
        const allNotifs = await notificationService.getNotifications(user.email, 200);
        const related = allNotifs.filter(n => (
          n.relatedTaskId === taskId || n.data?.taskId === taskId
        ) && !n.isRead);

        await Promise.all(related.map(n => notificationService.markAsRead(user.email, n.id)));
      })();
    } catch (err) {
      console.error('Initial-load notification read marking failed:', err);
    }
  }, [user?.email]);

  const playNotificationSound = useCallback(() => {
    try {
      const audio = new Audio('/audio/mixkit-bell-notification-933.wav');
      audio.play().catch(error => {
        console.warn("Failed to play notification sound:", error);
      });
    } catch (error) {
      console.warn("Audio not supported:", error);
    }
  }, []);

  const sendInAppNotification = useCallback(async (
    title: string, 
    body: string, 
    data?: NotificationData
  ): Promise<string | null> => {
    if (!user?.email) return null;

    try {
      // Use API endpoint for reliable notification creation
      const response = await fetch('/api/notifications/test-in-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: user.email,
          title,
          body,
          data
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        playNotificationSound();
        return result.notificationId;
      }
      
      return null;
    } catch (error) {
      console.error('Error sending in-app notification:', error);
      return null;
    }
  }, [user?.email, playNotificationSound]);

  const markAsRead = useCallback(async (notificationId: string): Promise<void> => {
    if (!user?.email) return;

    try {
      await notificationService.markAsRead(user.email, notificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [user?.email]);

  const markAllAsRead = useCallback(async (): Promise<void> => {
    if (!user?.email) return;

    try {
      await notificationService.markAllAsRead(user.email);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [user?.email]);

  const deleteNotification = useCallback(async (notificationId: string): Promise<void> => {
    if (!user?.email) return;

    try {
      await notificationService.deleteNotification(user.email, notificationId);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [user?.email]);

  const clearAllNotifications = useCallback(async (): Promise<void> => {
    if (!user?.email) return;

    try {
      await notificationService.clearAllNotifications(user.email);
      displayedNotificationsRef.current.clear();
    } catch (error) {
      console.error('Error clearing all notifications:', error);
    }
  }, [user?.email]);

  const requestPermission = useCallback(async (): Promise<void> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast({
        title: "Notifications Not Supported",
        description: "Your browser does not support notifications.",
        variant: "destructive",
      });
      return;
    }

    try {
      const status = await Notification.requestPermission();
      setPermission(status);

      if (status === 'granted') {
        toast({
          title: "Notifications Enabled! 🎉",
          description: "You'll now receive real-time task reminders.",
        });
      } else if (status === 'denied') {
        toast({
          title: "Notifications Blocked",
          description: "To enable them, you'll need to change your browser settings.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast({
        title: "Permission Error",
        description: "Failed to request notification permission.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const refreshStats = useCallback(async (): Promise<void> => {
    if (!user?.email) return;

    try {
      const stats = await notificationService.getNotificationStats(user.email);
      setUnreadCount(stats.unreadCount);
    } catch (error) {
      console.error('Error refreshing notification stats:', error);
    }
  }, [user?.email]);

  const contextValue: UnifiedNotificationContextType = {
    notifications,
    unreadCount,
    isLoading,
    sendInAppNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    permission,
    requestPermission,
    refreshStats,
  };

  return (
    <UnifiedNotificationContext.Provider value={contextValue}>
      {children}
    </UnifiedNotificationContext.Provider>
  );
};

export const useUnifiedNotifications = (): UnifiedNotificationContextType => {
  const context = useContext(UnifiedNotificationContext);
  if (context === undefined) {
    // SSR-safe fallback
    if (typeof window === 'undefined') {
      return {
        notifications: [],
        unreadCount: 0,
        isLoading: false,
        sendInAppNotification: async () => null,
        markAsRead: async () => {},
        markAllAsRead: async () => {},
        deleteNotification: async () => {},
        clearAllNotifications: async () => {},
        permission: 'default',
        requestPermission: async () => {},
        refreshStats: async () => {},
      };
    }
    throw new Error('useUnifiedNotifications must be used within a UnifiedNotificationProvider');
  }
  return context;
};

// Hook for just unread count (optimized for performance)
export const useNotificationBadge = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.email) {
      setUnreadCount(0);
      return;
    }

    // Subscribe to just unread count for better performance
    const unsubscribe = notificationService.subscribeToUnreadCount(
      user.email,
      setUnreadCount
    );

    return unsubscribe;
  }, [user?.email]);

  return unreadCount;
};
