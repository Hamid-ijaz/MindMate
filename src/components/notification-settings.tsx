"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, BellOff, Smartphone, AlertCircle, CheckCircle2 } from 'lucide-react';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useToast } from '@/hooks/use-toast';

export function NotificationSettings() {
  const {
    isSupported,
    permission,
    subscription,
    requestPermission,
    subscribe,
    unsubscribe,
    sendNotification,
  } = usePushNotifications();
  
  const { toast } = useToast();
  const [testingNotification, setTestingNotification] = useState(false);
  const [reminderSettings, setReminderSettings] = useState({
    taskReminders: true,
    dailyDigest: false,
    completionCelebrations: true,
    reminderTime: '09:00', // Default reminder time
  });

  const handleToggleNotifications = async () => {
    if (subscription) {
      await unsubscribe();
    } else {
      const permissionGranted = await requestPermission();
      if (permissionGranted) {
        await subscribe();
      }
    }
  };

  const handleTestNotification = async () => {
    setTestingNotification(true);
    
    const success = await sendNotification({
      title: 'MindMate Test Notification',
      body: 'Great! Your notifications are working perfectly. 🎉',
      data: { type: 'test' },
      actions: [
        { action: 'dismiss', title: 'Dismiss' },
        { action: 'open', title: 'Open App' },
      ],
    });

    if (success) {
      toast({
        title: "Test Sent!",
        description: "Check your notification area to see the test notification.",
      });
    } else {
      toast({
        title: "Test Failed",
        description: "Unable to send test notification. Please check your permissions.",
        variant: "destructive",
      });
    }
    
    setTestingNotification(false);
  };

  const updateReminderSetting = (key: keyof typeof reminderSettings, value: boolean | string) => {
    setReminderSettings(prev => ({
      ...prev,
      [key]: value,
    }));
    
    // Here you would typically save to your backend/local storage
    localStorage.setItem('mindmate-reminder-settings', JSON.stringify({
      ...reminderSettings,
      [key]: value,
    }));
  };

  const getPermissionBadge = () => {
    switch (permission) {
      case 'granted':
        return <Badge className="bg-green-100 text-green-800">Enabled</Badge>;
      case 'denied':
        return <Badge variant="destructive">Denied</Badge>;
      default:
        return <Badge variant="outline">Not Set</Badge>;
    }
  };

  const getPermissionIcon = () => {
    switch (permission) {
      case 'granted':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'denied':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Bell className="h-5 w-5 text-muted-foreground" />;
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Push notifications are not supported in this browser
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8 text-center">
            <div className="space-y-2">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                Your browser doesn't support push notifications. 
                Try using Chrome, Firefox, or Safari for the best experience.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getPermissionIcon()}
            Push Notifications
          </CardTitle>
          <CardDescription>
            Get notified about task reminders, deadlines, and updates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Permission Status */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Notification Permission</p>
                <p className="text-sm text-muted-foreground">
                  {permission === 'granted' && 'Notifications are enabled'}
                  {permission === 'denied' && 'Notifications are blocked'}
                  {permission === 'default' && 'Permission not requested'}
                </p>
              </div>
            </div>
            {getPermissionBadge()}
          </div>

          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="notifications-enabled" className="text-base font-medium">
                Enable Push Notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications even when MindMate is closed
              </p>
            </div>
            <Switch
              id="notifications-enabled"
              checked={!!subscription}
              onCheckedChange={handleToggleNotifications}
              disabled={permission === 'denied'}
            />
          </div>

          {/* Test Notification Button */}
          {subscription && (
            <Button
              onClick={handleTestNotification}
              disabled={testingNotification}
              variant="outline"
              className="w-full"
            >
              {testingNotification ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                  Sending Test...
                </>
              ) : (
                <>
                  <Bell className="mr-2 h-4 w-4" />
                  Send Test Notification
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
            <CardDescription>
              Customize what notifications you want to receive
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Task Reminders */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="task-reminders" className="text-base font-medium">
                  Task Reminders
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get notified about upcoming task deadlines
                </p>
              </div>
              <Switch
                id="task-reminders"
                checked={reminderSettings.taskReminders}
                onCheckedChange={(checked) => updateReminderSetting('taskReminders', checked)}
              />
            </div>

            {/* Completion Celebrations */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="completion-celebrations" className="text-base font-medium">
                  Completion Celebrations
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get positive reinforcement when you complete tasks
                </p>
              </div>
              <Switch
                id="completion-celebrations"
                checked={reminderSettings.completionCelebrations}
                onCheckedChange={(checked) => updateReminderSetting('completionCelebrations', checked)}
              />
            </div>

            {/* Daily Digest */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="daily-digest" className="text-base font-medium">
                  Daily Digest
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive a summary of your tasks every morning
                </p>
              </div>
              <Switch
                id="daily-digest"
                checked={reminderSettings.dailyDigest}
                onCheckedChange={(checked) => updateReminderSetting('dailyDigest', checked)}
              />
            </div>

            {/* Daily Digest Time */}
            {reminderSettings.dailyDigest && (
              <div className="ml-4 p-4 border-l-2 border-muted">
                <Label htmlFor="reminder-time" className="text-sm font-medium">
                  Daily Digest Time
                </Label>
                <Select
                  value={reminderSettings.reminderTime}
                  onValueChange={(value) => updateReminderSetting('reminderTime', value)}
                >
                  <SelectTrigger className="w-full mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="07:00">7:00 AM</SelectItem>
                    <SelectItem value="08:00">8:00 AM</SelectItem>
                    <SelectItem value="09:00">9:00 AM</SelectItem>
                    <SelectItem value="10:00">10:00 AM</SelectItem>
                    <SelectItem value="18:00">6:00 PM</SelectItem>
                    <SelectItem value="19:00">7:00 PM</SelectItem>
                    <SelectItem value="20:00">8:00 PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
