'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';

interface NotificationPreferences {
  enabled: boolean;
  overdueReminders: boolean;
  dailyDigest: boolean;
  weeklyReport: boolean;
  taskReminders: boolean;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  reminderTiming: {
    beforeDue: number;
    afterDue: number;
  };
}

interface UseNotificationManagerReturn {
  // State
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  preferences: NotificationPreferences | null;
  isLoading: boolean;
  
  // Actions
  requestPermission: () => Promise<boolean>;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<boolean>;
  sendTestNotification: () => Promise<boolean>;
  
  // Utilities
  shouldShowPrompt: () => boolean;
  refresh: () => Promise<void>;
}

export function useNotificationManager(): UseNotificationManagerReturn {
  const { user } = useAuth();
  
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize and check support
  useEffect(() => {
    if ('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  // Load preferences when user changes
  useEffect(() => {
    if (user?.email && isSupported) {
      loadUserPreferences();
    }
  }, [user, isSupported]);

  const loadUserPreferences = useCallback(async () => {
    if (!user?.email) return;
    
    try {
      const response = await fetch(`/api/notifications/preferences?userEmail=${encodeURIComponent(user.email)}`);
      const data = await response.json();
      
      if (data.success) {
        setPreferences(data.preferences);
        setIsSubscribed(data.hasActiveSubscriptions);
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    }
  }, [user?.email]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user?.email || !isSupported) return false;

    setIsLoading(true);
    try {
      // Ensure permission is granted
      if (permission !== 'granted') {
        const permissionGranted = await requestPermission();
        if (!permissionGranted) {
          return false;
        }
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      
      // Subscribe to push notifications - convert VAPID key to Uint8Array

      function urlBase64ToUint8Array(base64String: string) {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string | undefined;
      if (!vapidKey) {
        throw new Error('VAPID public key not configured');
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidKey);

      // Subscribe using the converted key
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // Get device info
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen: {
          width: window.screen.width,
          height: window.screen.height
        }
      };

      // Send subscription to server
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: user.email,
          subscription,
          deviceInfo
        })
      });

      const data = await response.json();

      if (data.success) {
        setIsSubscribed(true);
        
        // Enable default preferences if not set
        if (!preferences?.enabled) {
          const defaultPreferences: NotificationPreferences = {
            enabled: true,
            overdueReminders: true,
            taskReminders: true,
            dailyDigest: false,
            weeklyReport: false,
            quietHours: {
              enabled: false,
              start: '22:00',
              end: '08:00'
            },
            reminderTiming: {
              beforeDue: 15,
              afterDue: 60
            }
          };
          
          await updatePreferences(defaultPreferences);
        }
        
        return true;
      } else {
        throw new Error(data.error || 'Failed to subscribe');
      }
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user?.email, isSupported, permission, preferences, requestPermission]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!user?.email) return false;

    setIsLoading(true);
    try {
      // Unsubscribe from server
      const response = await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: user.email
        })
      });

      const data = await response.json();

      if (data.success) {
        setIsSubscribed(false);
        
        // Update preferences to disable notifications
        if (preferences) {
          await updatePreferences({ ...preferences, enabled: false });
        }
        
        return true;
      } else {
        throw new Error(data.error || 'Failed to unsubscribe');
      }
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user?.email, preferences]);

  const updatePreferences = useCallback(async (newPreferences: Partial<NotificationPreferences>): Promise<boolean> => {
    if (!user?.email) return false;

    setIsLoading(true);
    try {
      const updatedPreferences = { ...preferences, ...newPreferences };
      
      const response = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: user.email,
          preferences: updatedPreferences
        })
      });

      const data = await response.json();

      if (data.success) {
        setPreferences(updatedPreferences as NotificationPreferences);
        return true;
      } else {
        throw new Error(data.error || 'Failed to update preferences');
      }
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user?.email, preferences]);

  const sendTestNotification = useCallback(async (): Promise<boolean> => {
    if (!user?.email || !preferences?.enabled) return false;

    try {
      const response = await fetch('/api/notifications/send-task-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: 'test',
          userEmail: user.email,
          title: 'MindMate Test Notification',
          message: 'Great! Your notifications are working perfectly. 🎉'
        })
      });

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Error sending test notification:', error);
      return false;
    }
  }, [user?.email, preferences]);

  const shouldShowPrompt = useCallback((): boolean => {
    if (!isSupported || permission === 'granted' || permission === 'denied') {
      return false; // Don't show if not supported, already granted, or denied
    }

    if (!user?.email) {
      return false; // Don't show if user not logged in
    }

    if (isSubscribed) {
      return false; // Don't show if already subscribed
    }

    // Check if user dismissed recently (within 7 days)
    const lastDismissed = localStorage.getItem('notificationPromptDismissed');
    if (lastDismissed) {
      const dismissedTime = parseInt(lastDismissed);
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      if (dismissedTime > sevenDaysAgo) {
        return false;
      }
    }

    return true;
  }, [isSupported, permission, user?.email, isSubscribed]);

  const refresh = useCallback(async (): Promise<void> => {
    if (user?.email && isSupported) {
      await loadUserPreferences();
    }
  }, [user?.email, isSupported, loadUserPreferences]);

  return {
    // State
    isSupported,
    permission,
    isSubscribed,
    preferences,
    isLoading,
    
    // Actions
    requestPermission,
    subscribe,
    unsubscribe,
    updatePreferences,
    sendTestNotification,
    
    // Utilities
    shouldShowPrompt,
    refresh
  };
}
