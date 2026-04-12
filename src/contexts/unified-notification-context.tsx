'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { useAuth } from './auth-context';
import { notificationApiService } from '@/services/client/notification-api-service';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import type { NotificationDocument, NotificationData } from '@/lib/types';

const NOTIFICATIONS_POLL_INTERVAL_MS = 10000;

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
  const isInitialLoadRef = useRef(true);
  const getDismissedKey = (email?: string) => `mindmate-dismissed-toasts:${email ?? 'anon'}`;

  const applyFetchedNotifications = useCallback((newNotifications: NotificationDocument[]) => {
    setNotifications(newNotifications);
    setUnreadCount(newNotifications.filter(n => !n.isRead).length);

    const isMobileViewport =
      typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

    if (isMobileViewport && isInitialLoadRef.current) {
      newNotifications.forEach(notif => {
        if (!notif.isRead) {
          displayedNotificationsRef.current.add(notif.id);
        }
      });
      isInitialLoadRef.current = false;
      return;
    }

    // Show toast notifications for new unread notifications.
    newNotifications.forEach(notif => {
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

    isInitialLoadRef.current = false;
  }, [toast, user?.email]);

  const fetchNotifications = useCallback(async (maxCount = 200): Promise<void> => {
    if (!user?.email) {
      return;
    }

    const newNotifications = await notificationApiService.listNotifications(user.email, maxCount);
    applyFetchedNotifications(newNotifications);
  }, [applyFetchedNotifications, user?.email]);

  // Initialize permission state
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Poll notifications when user is available.
  useEffect(() => {
    isInitialLoadRef.current = true;

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
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    let isFetching = false;

    const pollNotifications = async () => {
      if (isFetching) {
        return;
      }

      isFetching = true;
      try {
        await fetchNotifications(200);
      } catch (error) {
        if (isMounted) {
          console.error('Failed to poll notifications:', error);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
        isFetching = false;
      }
    };

    setIsLoading(true);
    void pollNotifications();
    const intervalId = window.setInterval(() => {
      void pollNotifications();
    }, NOTIFICATIONS_POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [fetchNotifications, user?.email]);

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
        const allNotifs = await notificationApiService.listNotifications(user.email, 200);
        const related = allNotifs.filter(n => (
          n.relatedTaskId === taskId || n.data?.taskId === taskId
        ) && !n.isRead);

        await Promise.all(related.map(n => notificationApiService.markAsRead(user.email, n.id)));
        await fetchNotifications(200);
      } catch (err) {
        console.error('Failed to process service worker message for notifications:', err);
      }
    };

    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [fetchNotifications, user?.email]);

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
        const allNotifs = await notificationApiService.listNotifications(user.email, 200);
        const related = allNotifs.filter(n => (
          n.relatedTaskId === taskId || n.data?.taskId === taskId
        ) && !n.isRead);

        await Promise.all(related.map(n => notificationApiService.markAsRead(user.email, n.id)));
        await fetchNotifications(200);
      })();
    } catch (err) {
      console.error('Initial-load notification read marking failed:', err);
    }
  }, [fetchNotifications, user?.email]);

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
      const notificationId = await notificationApiService.sendInAppNotification(
        user.email,
        title,
        body,
        data
      );

      if (notificationId) {
        playNotificationSound();
        await fetchNotifications(200);
        return notificationId;
      }

      return null;
    } catch (error) {
      console.error('Error sending in-app notification:', error);
      return null;
    }
  }, [fetchNotifications, playNotificationSound, user?.email]);

  const markAsRead = useCallback(async (notificationId: string): Promise<void> => {
    if (!user?.email) return;

    try {
      await notificationApiService.markAsRead(user.email, notificationId);
      const readAt = Date.now();
      setNotifications(prev => {
        const next = prev.map(notification => {
          if (notification.id !== notificationId || notification.isRead) {
            return notification;
          }

          return {
            ...notification,
            isRead: true,
            readAt,
          };
        });

        setUnreadCount(next.filter(notification => !notification.isRead).length);
        return next;
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [user?.email]);

  const markAllAsRead = useCallback(async (): Promise<void> => {
    if (!user?.email) return;

    try {
      await notificationApiService.markAllAsRead(user.email);
      const readAt = Date.now();
      setNotifications(prev => prev.map(notification => ({
        ...notification,
        isRead: true,
        readAt: notification.readAt ?? readAt,
      })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [user?.email]);

  const deleteNotification = useCallback(async (notificationId: string): Promise<void> => {
    if (!user?.email) return;

    try {
      await notificationApiService.deleteNotification(user.email, notificationId);
      setNotifications(prev => {
        const next = prev.filter(notification => notification.id !== notificationId);
        setUnreadCount(next.filter(notification => !notification.isRead).length);
        return next;
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [user?.email]);

  const clearAllNotifications = useCallback(async (): Promise<void> => {
    if (!user?.email) return;

    try {
      await notificationApiService.clearAllNotifications(user.email);
      setNotifications([]);
      setUnreadCount(0);
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
      const stats = await notificationApiService.getNotificationStats(user.email);
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

    let isMounted = true;

    const refreshUnreadCount = async () => {
      try {
        const stats = await notificationApiService.getNotificationStats(user.email);
        if (isMounted) {
          setUnreadCount(stats.unreadCount);
        }
      } catch (error) {
        if (isMounted) {
          console.error('Failed to poll unread notification count:', error);
        }
      }
    };

    void refreshUnreadCount();
    const intervalId = window.setInterval(() => {
      void refreshUnreadCount();
    }, NOTIFICATIONS_POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [user?.email]);

  return unreadCount;
};
