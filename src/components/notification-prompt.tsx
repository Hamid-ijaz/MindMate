'use client';

import React, { useState, useEffect } from 'react';
import { Bell, X, Zap, Shield, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';

interface NotificationPromptProps {
  onDismiss?: () => void;
  onSubscribed?: () => void;
}

export function NotificationPrompt({ onDismiss, onSubscribed }: NotificationPromptProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    if ('Notification' in window && 'serviceWorker' in navigator) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const handleEnableNotifications = async () => {
    if (!user?.email || !isSupported) return;

    setIsLoading(true);
    try {
      // Request permission
      const permission = await Notification.requestPermission();
      setPermission(permission);

      if (permission === 'granted') {
        // Subscribe to push notifications
        const registration = await navigator.serviceWorker.ready;
        
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
          // Enable notifications in preferences
          await fetch('/api/notifications/preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userEmail: user.email,
              preferences: {
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
              }
            })
          });

          toast({
            title: 'Notifications enabled!',
            description: 'You\'ll now receive push notifications for your tasks.'
          });

          onSubscribed?.();
        } else {
          throw new Error(data.error || 'Failed to subscribe');
        }
      } else {
        toast({
          title: 'Notifications denied',
          description: 'You can enable notifications later in settings.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      toast({
        title: 'Error',
        description: 'Failed to enable notifications. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    // Store dismissal in localStorage to avoid showing again too soon
    localStorage.setItem('notificationPromptDismissed', Date.now().toString());
    onDismiss?.();
  };

  if (!isSupported) {
    return null; // Don't show prompt if notifications aren't supported
  }

  if (permission === 'granted') {
    return null; // Don't show if already granted
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-blue-500/5">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Stay on top of your tasks
                <Badge variant="secondary" className="text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  Smart
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                Get notified about overdue tasks and upcoming deadlines
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Never miss a deadline
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Overdue task alerts
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Customizable timing
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={handleEnableNotifications}
              disabled={isLoading}
              className="flex-1"
            >
              <Bell className="h-4 w-4 mr-2" />
              {isLoading ? 'Enabling...' : 'Enable Notifications'}
            </Button>
            <Button
              variant="outline"
              onClick={handleDismiss}
              className="sm:w-auto"
            >
              Maybe later
            </Button>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3 w-3" />
            Your privacy is protected. Notifications are sent securely and you can unsubscribe anytime.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
