'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { NotificationPreferences } from '@/lib/types';
import { 
  Bell, 
  BellOff, 
  Clock, 
  Smartphone, 
  Mail, 
  Volume2, 
  VolumeX, 
  Moon, 
  Settings2,
  TestTube,
  Shield,
  Zap,
  Users,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';

interface NotificationPreferencesProps {
  className?: string;
}

const defaultPreferences: NotificationPreferences = {
  pushEnabled: true,
  emailEnabled: false,
  reminderEnabled: true,
  overdueEnabled: true,
  quietHoursEnabled: true,
  quietHours: {
    start: '22:00',
    end: '08:00',
  },
  reminderTiming: {
    beforeMinutes: 15,
    smartTiming: true,
  },
  notificationTypes: {
    taskReminders: true,
    overdueTasks: true,
    recurringTasks: true,
    collaborationUpdates: false,
    systemNotifications: true,
  },
  deliverySettings: {
    sound: true,
    vibration: true,
    priority: 'normal',
    groupSimilar: true,
    maxDaily: 20,
  },
};

export function NotificationPreferences({ className }: NotificationPreferencesProps) {
  const { user, updateUser } = useAuth();
  const { 
    isSupported, 
    permission, 
    subscription, 
    isLoading: pushLoading,
    requestPermission,
    subscribe,
    unsubscribe,
    testNotification 
  } = usePushNotifications();
  const { toast } = useToast();

  const [preferences, setPreferences] = useState<NotificationPreferences>(
    user?.notificationPreferences || defaultPreferences
  );
  const [isTestingNotification, setIsTestingNotification] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (user?.notificationPreferences) {
      setPreferences(user.notificationPreferences);
    }
  }, [user]);

  const handlePreferenceChange = (
    section: keyof NotificationPreferences,
    key: string,
    value: any
  ) => {
    setPreferences(prev => ({
      ...prev,
      [section]: typeof prev[section] === 'object' && prev[section] !== null
        ? { ...prev[section], [key]: value }
        : value
    }));
    setHasChanges(true);
  };

  const handleSavePreferences = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      await updateUser({
        ...user,
        notificationPreferences: preferences
      });
      
      setHasChanges(false);
      toast({
        title: "Preferences Saved",
        description: "Your notification preferences have been updated.",
        duration: 3000,
      });
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save your preferences. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnablePushNotifications = async () => {
    if (permission === 'granted') {
      if (!subscription) {
        await subscribe();
      }
      handlePreferenceChange('pushEnabled', '', true);
    } else {
      const granted = await requestPermission();
      if (granted) {
        await subscribe();
        handlePreferenceChange('pushEnabled', '', true);
      }
    }
  };

  const handleDisablePushNotifications = async () => {
    await unsubscribe();
    handlePreferenceChange('pushEnabled', '', false);
  };

  const handleTestNotification = async () => {
    setIsTestingNotification(true);
    try {
      const success = await testNotification();
      if (success) {
        toast({
          title: "Test Successful",
          description: "Test notification sent successfully!",
        });
      } else {
        toast({
          title: "Test Failed",
          description: "Failed to send test notification. Check your settings.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Test Error",
        description: "An error occurred while testing notifications.",
        variant: "destructive",
      });
    } finally {
      setIsTestingNotification(false);
    }
  };

  const getPermissionStatus = () => {
    if (!isSupported) {
      return {
        status: 'unsupported',
        message: 'Push notifications not supported in this browser',
        icon: <BellOff className="h-4 w-4 text-muted-foreground" />,
        color: 'secondary'
      };
    }

    switch (permission) {
      case 'granted':
        return {
          status: 'granted',
          message: subscription ? 'Active subscription' : 'Permission granted',
          icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
          color: 'success'
        };
      case 'denied':
        return {
          status: 'denied',
          message: 'Notifications blocked in browser',
          icon: <BellOff className="h-4 w-4 text-red-600" />,
          color: 'destructive'
        };
      default:
        return {
          status: 'default',
          message: 'Permission not requested',
          icon: <Bell className="h-4 w-4 text-yellow-600" />,
          color: 'warning'
        };
    }
  };

  const permissionStatus = getPermissionStatus();

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Preferences
            </CardTitle>
            <CardDescription>
              Customize how and when you receive task reminders and updates
            </CardDescription>
          </div>
          {hasChanges && (
            <Button 
              onClick={handleSavePreferences} 
              disabled={isSaving}
              size="sm"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Save Changes
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        {/* Push Notification Status */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Push Notifications</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Real-time browser notifications for task reminders
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={permissionStatus.color as any} className="flex items-center gap-1">
                {permissionStatus.icon}
                {permissionStatus.message}
              </Badge>
              {isSupported && (
                <Switch
                  checked={preferences.pushEnabled && permission === 'granted'}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      handleEnablePushNotifications();
                    } else {
                      handleDisablePushNotifications();
                    }
                  }}
                  disabled={pushLoading || !isSupported}
                />
              )}
            </div>
          </div>

          {permission === 'granted' && preferences.pushEnabled && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestNotification}
                disabled={isTestingNotification}
              >
                {isTestingNotification ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Test Notification
              </Button>
            </div>
          )}
        </div>

        <Separator />

        {/* Notification Types */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Notification Types</Label>
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="font-medium">Task Reminders</p>
                  <p className="text-sm text-muted-foreground">
                    Notifications for upcoming tasks and deadlines
                  </p>
                </div>
              </div>
              <Switch
                checked={preferences.notificationTypes.taskReminders}
                onCheckedChange={(checked) =>
                  handlePreferenceChange('notificationTypes', 'taskReminders', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <div>
                  <p className="font-medium">Overdue Tasks</p>
                  <p className="text-sm text-muted-foreground">
                    Notifications for tasks past their due date
                  </p>
                </div>
              </div>
              <Switch
                checked={preferences.notificationTypes.overdueTasks}
                onCheckedChange={(checked) =>
                  handlePreferenceChange('notificationTypes', 'overdueTasks', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="h-4 w-4 text-green-600" />
                <div>
                  <p className="font-medium">Recurring Tasks</p>
                  <p className="text-sm text-muted-foreground">
                    Notifications for recurring task instances
                  </p>
                </div>
              </div>
              <Switch
                checked={preferences.notificationTypes.recurringTasks}
                onCheckedChange={(checked) =>
                  handlePreferenceChange('notificationTypes', 'recurringTasks', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="font-medium">Collaboration Updates</p>
                  <p className="text-sm text-muted-foreground">
                    Shared task comments and changes
                  </p>
                </div>
              </div>
              <Switch
                checked={preferences.notificationTypes.collaborationUpdates}
                onCheckedChange={(checked) =>
                  handlePreferenceChange('notificationTypes', 'collaborationUpdates', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings2 className="h-4 w-4 text-gray-600" />
                <div>
                  <p className="font-medium">System Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    App updates and important announcements
                  </p>
                </div>
              </div>
              <Switch
                checked={preferences.notificationTypes.systemNotifications}
                onCheckedChange={(checked) =>
                  handlePreferenceChange('notificationTypes', 'systemNotifications', checked)
                }
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Timing Settings */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Timing & Schedule</Label>
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Reminder Timing</p>
                <p className="text-sm text-muted-foreground">
                  How far in advance to send reminders
                </p>
              </div>
              <Select
                value={preferences.reminderTiming.beforeMinutes.toString()}
                onValueChange={(value) =>
                  handlePreferenceChange('reminderTiming', 'beforeMinutes', parseInt(value))
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="1440">1 day</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Smart Timing</p>
                <p className="text-sm text-muted-foreground">
                  AI-optimized notification timing based on your habits
                </p>
              </div>
              <Switch
                checked={preferences.reminderTiming.smartTiming}
                onCheckedChange={(checked) =>
                  handlePreferenceChange('reminderTiming', 'smartTiming', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Moon className="h-4 w-4 text-indigo-600" />
                <div>
                  <p className="font-medium">Quiet Hours</p>
                  <p className="text-sm text-muted-foreground">
                    Pause notifications during these hours
                  </p>
                </div>
              </div>
              <Switch
                checked={preferences.quietHoursEnabled}
                onCheckedChange={(checked) =>
                  handlePreferenceChange('quietHoursEnabled', '', checked)
                }
              />
            </div>

            {preferences.quietHoursEnabled && (
              <div className="ml-7 grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Start Time</Label>
                  <Input
                    type="time"
                    value={preferences.quietHours.start}
                    onChange={(e) =>
                      handlePreferenceChange('quietHours', 'start', e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label className="text-sm">End Time</Label>
                  <Input
                    type="time"
                    value={preferences.quietHours.end}
                    onChange={(e) =>
                      handlePreferenceChange('quietHours', 'end', e.target.value)
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Delivery Settings */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Delivery Settings</Label>
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {preferences.deliverySettings.sound ? (
                  <Volume2 className="h-4 w-4 text-blue-600" />
                ) : (
                  <VolumeX className="h-4 w-4 text-gray-400" />
                )}
                <div>
                  <p className="font-medium">Sound</p>
                  <p className="text-sm text-muted-foreground">
                    Play sound with notifications
                  </p>
                </div>
              </div>
              <Switch
                checked={preferences.deliverySettings.sound}
                onCheckedChange={(checked) =>
                  handlePreferenceChange('deliverySettings', 'sound', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="h-4 w-4 text-green-600" />
                <div>
                  <p className="font-medium">Vibration</p>
                  <p className="text-sm text-muted-foreground">
                    Vibrate device for notifications (mobile only)
                  </p>
                </div>
              </div>
              <Switch
                checked={preferences.deliverySettings.vibration}
                onCheckedChange={(checked) =>
                  handlePreferenceChange('deliverySettings', 'vibration', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Priority Level</p>
                <p className="text-sm text-muted-foreground">
                  How urgently notifications are displayed
                </p>
              </div>
              <Select
                value={preferences.deliverySettings.priority}
                onValueChange={(value) =>
                  handlePreferenceChange('deliverySettings', 'priority', value as 'low' | 'normal' | 'high')
                }
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Group Similar</p>
                <p className="text-sm text-muted-foreground">
                  Combine similar notifications together
                </p>
              </div>
              <Switch
                checked={preferences.deliverySettings.groupSimilar}
                onCheckedChange={(checked) =>
                  handlePreferenceChange('deliverySettings', 'groupSimilar', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Daily Limit</p>
                <p className="text-sm text-muted-foreground">
                  Maximum notifications per day
                </p>
              </div>
              <Input
                type="number"
                min="1"
                max="100"
                value={preferences.deliverySettings.maxDaily}
                onChange={(e) =>
                  handlePreferenceChange('deliverySettings', 'maxDaily', parseInt(e.target.value) || 20)
                }
                className="w-20"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Additional Settings */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Additional Options</Label>
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-orange-600" />
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via email as backup
                  </p>
                </div>
              </div>
              <Switch
                checked={preferences.emailEnabled}
                onCheckedChange={(checked) =>
                  handlePreferenceChange('emailEnabled', '', checked)
                }
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        {hasChanges && (
          <div className="flex justify-end pt-4 border-t">
            <Button 
              onClick={handleSavePreferences} 
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Save All Preferences
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
