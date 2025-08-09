'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './auth-context';

interface NotificationProviderState {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  preferences: NotificationPreferences | null;
}

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

interface NotificationProviderActions {
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<boolean>;
  sendTestNotification: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

type NotificationProviderContext = NotificationProviderState & NotificationProviderActions;

const NotificationContext = createContext<NotificationProviderContext | null>(null);

interface NotificationProviderProps {
  children: React.ReactNode;
}

export function ProfessionalNotificationProvider({ children }: NotificationProviderProps) {
  const { user } = useAuth();
  
  const [state, setState] = useState<NotificationProviderState>({
    isSupported: false,
    permission: 'default',
    isSubscribed: false,
    isLoading: false,
    preferences: null
  });

  // Initialize on mount
  useEffect(() => {
    const isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    setState(prev => ({
      ...prev,
      isSupported,
      permission: isSupported ? Notification.permission : 'denied'
    }));

    if (isSupported && user?.email) {
      loadUserPreferences();
    }
  }, [user]);

  const loadUserPreferences = async () => {
    if (!user?.email) return;
    
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const response = await fetch(`/api/notifications/preferences?userEmail=${encodeURIComponent(user.email)}`);
      const data = await response.json();
      
      if (data.success) {
        setState(prev => ({
          ...prev,
          preferences: data.preferences,
          isSubscribed: data.hasActiveSubscriptions,
          isLoading: false
        }));
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const subscribe = async (): Promise<boolean> => {
    if (!user?.email || !state.isSupported) return false;

    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      // Request permission if needed
      if (state.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        setState(prev => ({ ...prev, permission }));
        
        if (permission !== 'granted') {
          setState(prev => ({ ...prev, isLoading: false }));
          return false;
        }
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      
      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      });

      // Get device info
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
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
        // Enable default preferences if not set
        if (!state.preferences?.enabled) {
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
        
        setState(prev => ({
          ...prev,
          isSubscribed: true,
          isLoading: false
        }));
        
        return true;
      } else {
        throw new Error(data.error || 'Failed to subscribe');
      }
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  };

  const unsubscribe = async (): Promise<boolean> => {
    if (!user?.email) return false;

    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const response = await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: user.email
        })
      });

      const data = await response.json();

      if (data.success) {
        setState(prev => ({
          ...prev,
          isSubscribed: false,
          isLoading: false,
          preferences: state.preferences ? { ...state.preferences, enabled: false } : null
        }));
        
        return true;
      } else {
        throw new Error(data.error || 'Failed to unsubscribe');
      }
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  };

  const updatePreferences = async (newPreferences: Partial<NotificationPreferences>): Promise<boolean> => {
    if (!user?.email) return false;

    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const updatedPreferences = { ...state.preferences, ...newPreferences };
      
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
        setState(prev => ({
          ...prev,
          preferences: updatedPreferences as NotificationPreferences,
          isLoading: false
        }));
        
        return true;
      } else {
        throw new Error(data.error || 'Failed to update preferences');
      }
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  };

  const sendTestNotification = async (): Promise<boolean> => {
    if (!user?.email || !state.preferences?.enabled) return false;

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
  };

  const refresh = async (): Promise<void> => {
    if (user?.email && state.isSupported) {
      await loadUserPreferences();
    }
  };

  const contextValue: NotificationProviderContext = {
    ...state,
    subscribe,
    unsubscribe,
    updatePreferences,
    sendTestNotification,
    refresh
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useProfessionalNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useProfessionalNotifications must be used within a ProfessionalNotificationProvider');
  }
  return context;
}

// For backwards compatibility and ease of use
export { ProfessionalNotificationProvider as NotificationProvider };
