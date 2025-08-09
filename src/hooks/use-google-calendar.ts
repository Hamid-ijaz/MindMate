'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from './use-toast';
import type { GoogleCalendarSettings } from '@/lib/types';

export function useGoogleCalendar() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<GoogleCalendarSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Load Google Calendar settings
  useEffect(() => {
    if (user?.email) {
      loadSettings();
    }
  }, [user?.email]);

  const loadSettings = async () => {
    if (!user?.email) return;
    
    try {
      setLoading(true);
      const response = await fetch('/api/calendar/google/settings', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      } else {
        setSettings(null);
      }
    } catch (error) {
      console.error('Failed to load Google Calendar settings:', error);
      setSettings(null);
    } finally {
      setLoading(false);
    }
  };

  const connect = async () => {
    try {
      const response = await fetch('/api/calendar/google/auth', {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
        }
      } else {
        throw new Error('Failed to get authorization URL');
      }
    } catch (error) {
      console.error('Google Calendar connection error:', error);
      toast({
        title: "Connection Failed",
        description: "Unable to connect to Google Calendar. Please try again.",
        variant: "destructive",
      });
    }
  };

  const disconnect = async () => {
    if (!user?.email) return;

    try {
      const response = await fetch('/api/calendar/google/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.ok) {
        setSettings(null);
        toast({
          title: "Disconnected",
          description: "Google Calendar has been disconnected.",
        });
      } else {
        throw new Error('Failed to disconnect');
      }
    } catch (error) {
      console.error('Google Calendar disconnect error:', error);
      toast({
        title: "Disconnect Failed",
        description: "Unable to disconnect Google Calendar. Please try again.",
        variant: "destructive",
      });
    }
  };

  const syncTask = async (taskId: string, action: 'create' | 'update' | 'delete') => {
    if (!user?.email || !settings?.isConnected) {
      return { success: false, error: 'Google Calendar not connected' };
    }

    try {
      setSyncing(true);
      const response = await fetch('/api/calendar/google/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          taskId,
          userEmail: user.email,
          action,
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        return { success: true, eventId: data.eventId, eventUrl: data.eventUrl };
      } else {
        throw new Error(data.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Google Calendar sync error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Sync failed' 
      };
    } finally {
      setSyncing(false);
    }
  };

  return {
    settings,
    loading,
    syncing,
    isConnected: settings?.isConnected || false,
    connect,
    disconnect,
    syncTask,
    refresh: loadSettings,
  };
}
