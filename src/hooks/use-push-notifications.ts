import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from './use-toast';

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId?: string;
  userEmail?: string;
  deviceInfo?: {
    userAgent: string;
    platform: string;
    vendor: string;
  };
  subscribedAt?: number;
}

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    // Check if push notifications are supported
    const checkSupport = () => {
      const supported = 
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;
      
      setIsSupported(supported);
      
      if (supported) {
        setPermission(Notification.permission);
      }
    };

    checkSupport();
  }, []);

  useEffect(() => {
    // Get existing subscription on mount
    if (isSupported && user) {
      getSubscription();
    }
  }, [isSupported, user]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      toast({
        title: "Not Supported",
        description: "Push notifications are not supported in this browser.",
        variant: "destructive",
      });
      return false;
    }

    setIsLoading(true);
    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);

      if (permission === 'granted') {
        toast({
          title: "Notifications Enabled",
          description: "You'll now receive task reminders and updates.",
        });
        return true;
      } else {
        toast({
          title: "Notifications Disabled",
          description: "You can enable notifications in your browser settings.",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast({
        title: "Permission Error",
        description: "Failed to request notification permission.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, toast]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || permission !== 'granted' || !user) {
      return false;
    }

    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Get VAPID public key from environment
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      
      if (!vapidPublicKey) {
        throw new Error('VAPID public key not configured');
      }
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      // Convert subscription to our format with user info
      const subscriptionData: PushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: arrayBufferToBase64(subscription.getKey('auth')!),
        },
        userId: user.email, // Use email as consistent identifier
        userEmail: user.email,
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          vendor: navigator.vendor,
        },
        subscribedAt: Date.now(),
      };

      setSubscription(subscriptionData);

      // Send subscription to your backend
      await saveSubscription(subscriptionData);

      toast({
        title: "Subscribed to Notifications",
        description: "You'll receive push notifications for task reminders.",
      });

      return true;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      toast({
        title: "Subscription Failed",
        description: "Failed to subscribe to push notifications.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, permission, toast, user]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        await removeSubscription(user.email);
        setSubscription(null);

        toast({
          title: "Unsubscribed",
          description: "You'll no longer receive push notifications.",
        });

        return true;
      }
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      toast({
        title: "Unsubscribe Failed",
        description: "Failed to unsubscribe from push notifications.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }

    return false;
  }, [toast, user]);

  const getSubscription = useCallback(async () => {
    if (!user) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const subscriptionData: PushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
            auth: arrayBufferToBase64(subscription.getKey('auth')!),
          },
          userId: user.email, // Use email as consistent identifier
          userEmail: user.email,
        };
        setSubscription(subscriptionData);
      }
    } catch (error) {
      console.error('Error getting subscription:', error);
    }
  }, [user]);

  const sendNotification = useCallback(async (options: NotificationOptions) => {
    if (!isSupported || permission !== 'granted') {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(options.title, {
        body: options.body,
        icon: options.icon || '/icon-192.png',
        badge: options.badge || '/icon-192.png',
        data: options.data,
        actions: options.actions,
        tag: options.tag,
        requireInteraction: options.requireInteraction !== false,
        silent: options.silent || false,
        timestamp: Date.now(),
      });

      return true;
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  }, [isSupported, permission]);

  const testNotification = useCallback(async () => {
    return await sendNotification({
      title: "Test Notification",
      body: "This is how your task reminders will appear!",
      data: { test: true },
    });
  }, [sendNotification]);

  return {
    isSupported,
    permission,
    subscription,
    isLoading,
    requestPermission,
    subscribe,
    unsubscribe,
    sendNotification,
    testNotification,
  };
}

// Helper functions
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  return window.btoa(binary);
}

async function saveSubscription(subscription: PushSubscription) {
  try {
    const response = await fetch('/api/push/manage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to save subscription: ${errorData.error || 'Unknown error'}`);
    }

    const result = await response.json();
    console.log('Subscription saved successfully:', result);
  } catch (error) {
    console.error('Error saving subscription:', error);
    throw error;
  }
}

async function removeSubscription(userEmail?: string) {
  try {
    const queryParams = new URLSearchParams();
    if (userEmail) {
      queryParams.append('userEmail', userEmail);
    }

    const response = await fetch(`/api/push/manage?${queryParams.toString()}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to remove subscription: ${errorData.error || 'Unknown error'}`);
    }

    const result = await response.json();
    console.log('Subscription removed successfully:', result);
  } catch (error) {
    console.error('Error removing subscription:', error);
    throw error;
  }
}
