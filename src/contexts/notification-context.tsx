
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

type NotificationPermission = 'default' | 'granted' | 'denied';

export interface StoredNotification {
    id: string;
    title: string;
    body?: string;
    createdAt: number;
    isRead: boolean;
    data?: any;
}

interface NotificationOptions {
    body?: string;
    tag?: string;
    data?: any;
}

interface NotificationContextType {
  permission: NotificationPermission;
  requestPermission: () => void;
  sendNotification: (title: string, options?: NotificationOptions) => void;
  notifications: StoredNotification[];
  unreadCount: number;
  markAllAsRead: () => void;
  markAsRead: (id: string) => void;
  deleteNotification: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const NOTIFICATION_STORAGE_KEY = 'mindmate-notifications';

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);
  const { toast } = useToast();
  const displayedNotificationsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedNotifications = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
      if (storedNotifications) {
        setNotifications(JSON.parse(storedNotifications));
      }
      if ('Notification' in window) {
        setPermission(Notification.permission);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(notifications));
    }
  }, [notifications]);

  // This effect safely triggers toasts when new notifications are added.
  useEffect(() => {
    notifications.forEach(notif => {
      // Check if this notification has already been displayed
      if (!displayedNotificationsRef.current.has(notif.id)) {
        const { dismiss } = toast({
          title: notif.title,
          description: notif.body,
          duration: 30000,
          action: (
            <Button size="sm" onClick={() => dismiss()}>
              Dismiss
            </Button>
          ),
        });
        // Mark as displayed
        displayedNotificationsRef.current.add(notif.id);
      }
    });
  }, [notifications, toast]);

  const playNotificationSound = () => {
    const audio = new Audio('/audio/mixkit-bell-notification-933.wav');
    audio.play().catch(error => console.error("Failed to play notification sound:", error));
  };
  
  const sendNotification = useCallback((title: string, options: NotificationOptions = {}) => {
    if (typeof window === 'undefined') return;

    const notificationId = options.tag || String(Date.now());

    setNotifications(prev => {
        const existingNotification = prev.find(n => n.id === notificationId);
        if (existingNotification) return prev; 
        
        playNotificationSound();
        const newNotification: StoredNotification = {
            id: notificationId,
            title,
            body: options.body,
            createdAt: Date.now(),
            isRead: false,
            data: options.data
        };
        
        return [newNotification, ...prev].slice(0, 50);
    });

  }, []);


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
    } else if (status === 'denied') {
      toast({
        title: "Notifications Blocked",
        description: "To enable them, you'll need to go to your browser settings.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id && n.data?.taskId !== id));
  }, []);

  const clearAllNotifications = useCallback(async () => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <NotificationContext.Provider value={{ permission, requestPermission, sendNotification, notifications, unreadCount, markAllAsRead, markAsRead, deleteNotification, clearAllNotifications }}>
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
