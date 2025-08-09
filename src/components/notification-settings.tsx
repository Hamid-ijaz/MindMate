'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Bell, BellOff, Clock, Volume2, VolumeX, Smartphone, Monitor, Tablet, TestTube, X, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface NotificationPreferences {
  enabled: boolean;
  taskReminders: boolean;
  overdueAlerts: boolean;
  dailyDigest: boolean;
  weeklyReport: boolean;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  devices: {
    desktop: boolean;
    mobile: boolean;
    tablet: boolean;
  };
  sound: boolean;
  vibration: boolean;
}

export function NotificationSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { 
    isSupported, 
    permission, 
    subscription, 
    isLoading: pushLoading, 
    requestPermission, 
    subscribe: subscribeToPush 
  } = usePushNotifications();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    enabled: false,
    taskReminders: true,
    overdueAlerts: true,
    dailyDigest: true,
    weeklyReport: false,
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00',
    },
    devices: {
      desktop: true,
      mobile: true,
      tablet: true,
    },
    sound: true,
    vibration: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSend, setTestingSend] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'unknown' | 'subscribed' | 'unsubscribed'>('unknown');
  const [subscribedDevices, setSubscribedDevices] = useState<Array<{
    id: string;
    userAgent: string;
    platform: string;
    createdAt: number;
    isCurrentDevice: boolean;
  }>>([]);

  useEffect(() => {
    if (user?.email) {
      loadPreferences();
      checkSubscriptionStatus();
      loadSubscribedDevices();
    }
  }, [user]);

  const loadPreferences = async () => {
    if (!user?.email) return;

    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user.email}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("🚀 > loadPreferences > data:", data)
        if (data.preferences) {
          setPreferences(prev => ({ ...prev, ...data.preferences }));
        }
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubscribedDevices = async () => {
    if (!user?.email) return;

    try {
      const response = await fetch('/api/notifications/devices', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user.email}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.devices) {
          // Mark current device based on user agent
          const currentUserAgent = navigator.userAgent;
          const devicesWithCurrent = data.devices.map((device: any) => ({
            ...device,
            isCurrentDevice: device.userAgent === currentUserAgent
          }));
          setSubscribedDevices(devicesWithCurrent);
        }
      }
    } catch (error) {
      console.error('Failed to load subscribed devices:', error);
    }
  };

  const removeDeviceSubscription = async (deviceId: string) => {
    try {
      const response = await fetch('/api/notifications/devices', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.email}`,
        },
        body: JSON.stringify({ deviceId }),
      });

      if (response.ok) {
        setSubscribedDevices(prev => prev.filter(device => device.id !== deviceId));
        toast({
          title: 'Device removed',
          description: 'The device has been removed from notification subscriptions.',
        });
      } else {
        throw new Error('Failed to remove device');
      }
    } catch (error) {
      console.error('Failed to remove device:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove device subscription.',
        variant: 'destructive',
      });
    }
  };

  const getDeviceIcon = (userAgent: string) => {
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      return Smartphone;
    } else if (/Tablet|iPad/.test(userAgent)) {
      return Tablet;
    } else {
      return Monitor;
    }
  };

  const getDeviceName = (userAgent: string) => {
    if (/iPhone/.test(userAgent)) return 'iPhone';
    if (/iPad/.test(userAgent)) return 'iPad';
    if (/Android/.test(userAgent)) return 'Android Device';
    if (/Windows/.test(userAgent)) return 'Windows PC';
    if (/Mac/.test(userAgent)) return 'Mac';
    if (/Linux/.test(userAgent)) return 'Linux PC';
    return 'Unknown Device';
  };

  const handleAddDevice = async () => {
    if (!isSupported) {
      toast({
        title: 'Not Supported',
        description: 'Push notifications are not supported on this device.',
        variant: 'destructive',
      });
      return;
    }

    // Check if current device is already subscribed
    const currentUserAgent = navigator.userAgent;
    const deviceAlreadyExists = subscribedDevices.some(device => 
      device.userAgent === currentUserAgent && device.isCurrentDevice
    );

    if (deviceAlreadyExists) {
      toast({
        title: 'Device Already Added',
        description: 'This device is already subscribed to notifications.',
        variant: 'default',
      });
      return;
    }

    // Check if already subscribed (by checking existing subscription)
    if (subscription) {
      toast({
        title: 'Already Subscribed',
        description: 'This device is already subscribed to push notifications.',
        variant: 'default',
      });
      return;
    }

    // Request permission if not granted
    if (permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) {
        toast({
          title: 'Permission Denied',
          description: 'Please enable notifications to add this device.',
          variant: 'destructive',
        });
        return;
      }
    }

    // Subscribe to push notifications
    const success = await subscribeToPush();
    if (success) {
      // Reload the device list to show the new device
      await loadSubscribedDevices();
      toast({
        title: 'Device Added',
        description: 'This device has been added to your notification list.',
      });
    }
  };

  const checkSubscriptionStatus = async () => {
    try {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setSubscriptionStatus(subscription ? 'subscribed' : 'unsubscribed');
      }
    } catch (error) {
      console.error('Failed to check subscription status:', error);
    }
  };

  const savePreferences = async (newPreferences: NotificationPreferences) => {
    if (!user?.email) return;

    setSaving(true);
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.email}`,
        },
        body: JSON.stringify({ preferences: newPreferences }),
      });

      if (response.ok) {
        setPreferences(newPreferences);
        toast({
          title: 'Settings saved',
          description: 'Your notification preferences have been updated.',
        });
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to save notification preferences. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleNotifications = async () => {
    if (!preferences.enabled) {
      // Enable notifications - request permission and subscribe
      try {
        if (!('Notification' in window)) {
          toast({
            title: 'Not supported',
            description: 'Push notifications are not supported in this browser.',
            variant: 'destructive',
          });
          return;
        }

        const permission = await Notification.requestPermission();
        console.log("🚀 > handleToggleNotifications > permission:", permission)
        if (permission === 'granted') {
          // Subscribe to push notifications
          const registration = await navigator.serviceWorker.ready;

          // Helper to convert base64 VAPID key to Uint8Array
          function urlBase64ToUint8Array(base64String: string) {
            const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
            const base64 = (base64String + padding)
              .replace(/-/g, '+')
              .replace(/_/g, '/');
            const rawData = window.atob(base64);
            const outputArray = new Uint8Array(rawData.length);
            for (let i = 0; i < rawData.length; ++i) {
              outputArray[i] = rawData.charCodeAt(i);
            }
            return outputArray;
          }

          const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (!vapidKey) throw new Error('VAPID public key is not set');
          const convertedKey = urlBase64ToUint8Array(vapidKey);
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedKey,
          });
          const body = {
            userEmail: user?.email,
            subscription,
            deviceInfo: {
              userAgent: navigator.userAgent,
              platform: navigator.platform,
            },
          };
          console.log('Subscribe request body:', body);

          const response = await fetch('/api/notifications/subscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user?.email}`,
            },
            body: JSON.stringify(body),
          });

          if (response.ok) {
            const newPreferences = { ...preferences, enabled: true };
            await savePreferences(newPreferences);
            setSubscriptionStatus('subscribed');
            // Reload devices to show the new subscription
            await loadSubscribedDevices();
          } else {
            // Show error details from backend
            let errorMsg = 'Failed to enable notifications.';
            try {
              const errorData = await response.json();
              errorMsg = errorData?.error || errorMsg;
              console.error('Subscribe API error:', errorData);
            } catch (e) {
              // ignore
            }
            toast({
              title: 'Error',
              description: errorMsg,
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Permission denied',
            description: 'Please enable notifications in your browser settings.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Failed to enable notifications:', error);
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : String(error),
          variant: 'destructive',
        });
      }
    } else {
      // Disable notifications
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          await fetch('/api/notifications/unsubscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user?.email}`,
            },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });

          await subscription.unsubscribe();
        }

        const newPreferences = { ...preferences, enabled: false };
        await savePreferences(newPreferences);
        setSubscriptionStatus('unsubscribed');
      } catch (error) {
        console.error('Failed to disable notifications:', error);
        toast({
          title: 'Error',
          description: 'Failed to disable notifications. Please try again.',
          variant: 'destructive',
        });
      }
    }
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: any) => {
    const newPreferences = { ...preferences, [key]: value };
    await savePreferences(newPreferences);
  };

  const updateNestedPreference = async (parentKey: keyof NotificationPreferences, childKey: string, value: any) => {
    const newPreferences = {
      ...preferences,
      [parentKey]: {
        ...(preferences[parentKey] as any),
        [childKey]: value,
      },
    };
    await savePreferences(newPreferences);
  };

  const sendTestNotification = async () => {
    if (!preferences.enabled || subscriptionStatus !== 'subscribed') {
      toast({
        title: 'Cannot send test notification',
        description: 'Please enable notifications first.',
        variant: 'destructive',
      });
      return;
    }

    setTestingSend(true);
    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.email}`,
        },
        body: JSON.stringify({
          userEmail: user?.email,
          message: {
            title: 'Test Notification',
            body: 'This is a test notification from MindMate. Your notifications are working correctly!',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
          }
        }),
      });

      if (response.ok) {
        toast({
          title: 'Test notification sent!',
          description: 'You should receive a test notification shortly.',
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send test notification');
      }
    } catch (error) {
      console.error('Failed to send test notification:', error);
      toast({
        title: 'Test failed',
        description: error instanceof Error ? error.message : 'Failed to send test notification',
        variant: 'destructive',
      });
    } finally {
      setTestingSend(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Push Notifications</CardTitle>
          <CardDescription>Configure your notification preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="h-4 bg-muted rounded w-1/3"></div>
              <div className="h-6 bg-muted rounded w-12"></div>
            </div>
            <div className="h-px bg-muted"></div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center justify-between">
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                  <div className="h-6 bg-muted rounded w-12"></div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {preferences.enabled ? (
                <Bell className="h-5 w-5 text-primary" />
              ) : (
                <BellOff className="h-5 w-5 text-muted-foreground" />
              )}
              Push Notifications
            </CardTitle>
            <CardDescription>
              Get notified about task reminders, overdue items, and daily progress
            </CardDescription>
          </div>
          <Badge variant={subscriptionStatus === 'subscribed' ? 'default' : 'secondary'}>
            {subscriptionStatus === 'subscribed' ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Master Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-base font-medium">Enable Push Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Allow MindMate to send you push notifications
            </p>
          </div>
          <Switch
            checked={preferences.enabled}
            onCheckedChange={handleToggleNotifications}
            disabled={saving}
          />
        </div>

        {preferences.enabled && (
          <>
            <Separator />

            {/* Test Notification Button */}
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-dashed">
              <div className="space-y-1">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <TestTube className="h-4 w-4" />
                  Test Notifications
                </Label>
                <p className="text-xs text-muted-foreground">
                  Send a test notification to verify everything is working correctly
                </p>
              </div>
              <Button
                onClick={sendTestNotification}
                disabled={testingSend || subscriptionStatus !== 'subscribed'}
                variant="outline"
                size="sm"
              >
                {testingSend ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary mr-2"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <TestTube className="h-3 w-3 mr-2" />
                    Test
                  </>
                )}
              </Button>
            </div>

            <Separator />

            {/* Notification Types */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Notification Types</h4>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Task Reminders</Label>
                    <p className="text-xs text-muted-foreground">
                      Get reminded about upcoming tasks
                    </p>
                  </div>
                  <Switch
                    checked={preferences.taskReminders}
                    onCheckedChange={(checked) => updatePreference('taskReminders', checked)}
                    disabled={saving}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Overdue Alerts</Label>
                    <p className="text-xs text-muted-foreground">
                      Get notified about overdue tasks
                    </p>
                  </div>
                  <Switch
                    checked={preferences.overdueAlerts}
                    onCheckedChange={(checked) => updatePreference('overdueAlerts', checked)}
                    disabled={saving}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Daily Digest</Label>
                    <p className="text-xs text-muted-foreground">
                      Daily summary of your progress
                    </p>
                  </div>
                  <Switch
                    checked={preferences.dailyDigest}
                    onCheckedChange={(checked) => updatePreference('dailyDigest', checked)}
                    disabled={saving}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Weekly Report</Label>
                    <p className="text-xs text-muted-foreground">
                      Weekly overview of your achievements
                    </p>
                  </div>
                  <Switch
                    checked={preferences.weeklyReport}
                    onCheckedChange={(checked) => updatePreference('weeklyReport', checked)}
                    disabled={saving}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Quiet Hours */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Quiet Hours
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Don't send notifications during these hours
                  </p>
                </div>
                <Switch
                  checked={preferences.quietHours.enabled}
                  onCheckedChange={(checked) => updateNestedPreference('quietHours', 'enabled', checked)}
                  disabled={saving}
                />
              </div>

              {preferences.quietHours.enabled && (
                <div className="grid grid-cols-2 gap-4 ml-6">
                  <div className="space-y-2">
                    <Label className="text-xs">Start Time</Label>
                    <Select
                      value={preferences.quietHours.start}
                      onValueChange={(value) => updateNestedPreference('quietHours', 'start', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => {
                          const hour = i.toString().padStart(2, '0');
                          return (
                            <SelectItem key={hour} value={`${hour}:00`}>
                              {hour}:00
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">End Time</Label>
                    <Select
                      value={preferences.quietHours.end}
                      onValueChange={(value) => updateNestedPreference('quietHours', 'end', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => {
                          const hour = i.toString().padStart(2, '0');
                          return (
                            <SelectItem key={hour} value={`${hour}:00`}>
                              {hour}:00
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Device Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Device Preferences</h4>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    <Label className="text-sm">Desktop</Label>
                  </div>
                  <Switch
                    checked={preferences.devices.desktop}
                    onCheckedChange={(checked) => updateNestedPreference('devices', 'desktop', checked)}
                    disabled={saving}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    <Label className="text-sm">Mobile</Label>
                  </div>
                  <Switch
                    checked={preferences.devices.mobile}
                    onCheckedChange={(checked) => updateNestedPreference('devices', 'mobile', checked)}
                    disabled={saving}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tablet className="h-4 w-4" />
                    <Label className="text-sm">Tablet</Label>
                  </div>
                  <Switch
                    checked={preferences.devices.tablet}
                    onCheckedChange={(checked) => updateNestedPreference('devices', 'tablet', checked)}
                    disabled={saving}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Sound & Vibration */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {preferences.sound ? (
                    <Volume2 className="h-4 w-4" />
                  ) : (
                    <VolumeX className="h-4 w-4" />
                  )}
                  <Label className="text-sm">Sound</Label>
                </div>
                <Switch
                  checked={preferences.sound}
                  onCheckedChange={(checked) => updatePreference('sound', checked)}
                  disabled={saving}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  <Label className="text-sm">Vibration</Label>
                </div>
                <Switch
                  checked={preferences.vibration}
                  onCheckedChange={(checked) => updatePreference('vibration', checked)}
                  disabled={saving}
                />
              </div>
            </div>

            <Separator />

            {/* Connected Devices */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Connected Devices</h4>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {subscribedDevices.length} device{subscribedDevices.length !== 1 ? 's' : ''}
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleAddDevice}
                    disabled={subscriptionStatus === 'subscribed'}
                    className="text-xs h-7 px-2"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Device
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Devices that have notifications enabled for your account
              </p>

              {subscribedDevices.length > 0 ? (
                <div className="space-y-2">
                  {subscribedDevices.map((device) => {
                    const DeviceIcon = getDeviceIcon(device.userAgent);
                    return (
                      <div
                        key={device.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/20"
                      >
                        <div className="flex items-center gap-3">
                          <DeviceIcon className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {getDeviceName(device.userAgent)}
                              </span>
                              {device.isCurrentDevice && (
                                <Badge variant="secondary" className="text-xs">
                                  Current
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Connected {new Date(device.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {!device.isCurrentDevice && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDeviceSubscription(device.id)}
                            className="text-destructive hover:text-destructive h-8 px-2"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <Smartphone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No devices connected</p>
                  <p className="text-xs">Enable notifications to see connected devices</p>
                </div>
              )}
            </div>
          </>
        )}

        {saving && (
          <div className="flex items-center justify-center py-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              Saving preferences...
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
