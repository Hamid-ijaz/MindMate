"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  Bell, Clock, Smartphone, Mail, Calendar,
  Settings, Volume2, VolumeX, Zap
} from 'lucide-react';
import { useTasks } from '@/contexts/task-context';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';

interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  email: boolean;
  push: boolean;
  beforeMinutes: number;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  smartTiming: boolean;
}

export function SmartReminders() {
  const { tasks } = useTasks();
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    sound: true,
    email: false,
    push: true,
    beforeMinutes: 15,
    quietHours: {
      enabled: true,
      start: '22:00',
      end: '08:00',
    },
    smartTiming: true,
  });

  const upcomingTasks = tasks.filter(task => 
    task.reminderAt && 
    !task.completedAt &&
    task.reminderAt > Date.now() &&
    task.reminderAt < Date.now() + (24 * 60 * 60 * 1000) // Next 24 hours
  ).sort((a, b) => (a.reminderAt || 0) - (b.reminderAt || 0));

  const handleSettingChange = (key: keyof NotificationSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
    
    // Save to localStorage or backend
    localStorage.setItem('notificationSettings', JSON.stringify({
      ...settings,
      [key]: value
    }));
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        toast({
          title: "Notifications enabled!",
          description: "You'll receive reminders for your tasks.",
        });
      } else {
        toast({
          title: "Notifications blocked",
          description: "Please enable notifications in your browser settings.",
          variant: "destructive",
        });
      }
    }
  };

  const testNotification = () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('MindMate Reminder', {
        body: 'This is how your task reminders will look!',
        icon: '/favicon.svg',
        tag: 'test-notification'
      });
    } else {
      toast({
        title: "Test notification",
        description: "This is how your reminders will appear!",
      });
    }
  };

  useEffect(() => {
    // Load settings from localStorage
    const saved = localStorage.getItem('notificationSettings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Upcoming Reminders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Upcoming Reminders
          </CardTitle>
          <CardDescription>
            Tasks with reminders in the next 24 hours
          </CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingTasks.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No upcoming reminders
            </p>
          ) : (
            <div className="space-y-3">
              {upcomingTasks.slice(0, 5).map(task => (
                <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium">{task.title}</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" />
                      {new Date(task.reminderAt!).toLocaleString()}
                      <Badge variant="outline" className="text-xs">
                        {task.category}
                      </Badge>
                    </div>
                  </div>
                  <Badge variant={
                    task.priority === 'Critical' ? 'destructive' :
                    task.priority === 'High' ? 'default' : 'secondary'
                  }>
                    {task.priority}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Notification Settings
          </CardTitle>
          <CardDescription>
            Customize how and when you receive reminders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive reminders for your tasks
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => handleSettingChange('enabled', checked)}
            />
          </div>

          {settings.enabled && (
            <>
              {/* Notification Types */}
              <div className="space-y-4">
                <Label>Notification Types</Label>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    <span className="text-sm">Browser Push</span>
                  </div>
                  <Switch
                    checked={settings.push}
                    onCheckedChange={(checked) => handleSettingChange('push', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {settings.sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                    <span className="text-sm">Sound</span>
                  </div>
                  <Switch
                    checked={settings.sound}
                    onCheckedChange={(checked) => handleSettingChange('sound', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span className="text-sm">Email (coming soon)</span>
                  </div>
                  <Switch
                    checked={settings.email}
                    onCheckedChange={(checked) => handleSettingChange('email', checked)}
                    disabled
                  />
                </div>
              </div>

              {/* Timing Settings */}
              <div className="space-y-4">
                <Label>Timing</Label>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Remind me before</span>
                  <Select
                    value={settings.beforeMinutes.toString()}
                    onValueChange={(value) => handleSettingChange('beforeMinutes', parseInt(value))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 minutes</SelectItem>
                      <SelectItem value="10">10 minutes</SelectItem>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      <span className="text-sm">Smart Timing</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Optimize reminder timing based on your habits
                    </p>
                  </div>
                  <Switch
                    checked={settings.smartTiming}
                    onCheckedChange={(checked) => handleSettingChange('smartTiming', checked)}
                  />
                </div>
              </div>

              {/* Quiet Hours */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Quiet Hours</Label>
                    <p className="text-sm text-muted-foreground">
                      Don't send notifications during these hours
                    </p>
                  </div>
                  <Switch
                    checked={settings.quietHours.enabled}
                    onCheckedChange={(checked) => 
                      handleSettingChange('quietHours', { ...settings.quietHours, enabled: checked })
                    }
                  />
                </div>

                {settings.quietHours.enabled && (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">From</Label>
                      <input
                        type="time"
                        value={settings.quietHours.start}
                        onChange={(e) => 
                          handleSettingChange('quietHours', {
                            ...settings.quietHours,
                            start: e.target.value
                          })
                        }
                        className="px-2 py-1 border rounded text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">To</Label>
                      <input
                        type="time"
                        value={settings.quietHours.end}
                        onChange={(e) => 
                          handleSettingChange('quietHours', {
                            ...settings.quietHours,
                            end: e.target.value
                          })
                        }
                        className="px-2 py-1 border rounded text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={requestNotificationPermission}
                  className="flex-1"
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Enable Browser Notifications
                </Button>
                <Button
                  variant="outline"
                  onClick={testNotification}
                >
                  Test
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
