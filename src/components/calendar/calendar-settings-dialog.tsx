"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Palette, Clock, Bell, Calendar, RefreshCw, Eye, Filter } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { CalendarView } from '@/lib/types';

interface CalendarSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentView: CalendarView;
  onViewChange: (view: CalendarView) => void;
}

interface CalendarSettings {
  defaultView: CalendarView;
  weekStartsOn: number;
  workingHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  showWeekends: boolean;
  showCompletedTasks: boolean;
  colorCodingEnabled: boolean;
  timeFormat: '12h' | '24h';
  compactMode: boolean;
  showPomodoroCounts: boolean;
  autoSync: boolean;
  syncInterval: number;
  notifications: {
    taskReminders: boolean;
    syncUpdates: boolean;
    conflictAlerts: boolean;
  };
  theme: 'system' | 'light' | 'dark';
}

const defaultSettings: CalendarSettings = {
  defaultView: 'week',
  weekStartsOn: 1, // Monday
  workingHours: {
    enabled: true,
    start: '09:00',
    end: '17:00',
  },
  showWeekends: true,
  showCompletedTasks: true,
  colorCodingEnabled: true,
  timeFormat: '12h',
  compactMode: false,
  showPomodoroCounts: true,
  autoSync: true,
  syncInterval: 15,
  notifications: {
    taskReminders: true,
    syncUpdates: false,
    conflictAlerts: true,
  },
  theme: 'system',
};

export function CalendarSettings({ 
  open, 
  onOpenChange, 
  currentView, 
  onViewChange 
}: CalendarSettingsProps) {
  const [settings, setSettings] = useState<CalendarSettings>(defaultSettings);

  const updateSetting = <K extends keyof CalendarSettings>(
    key: K,
    value: CalendarSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateNestedSetting = <
    K extends keyof CalendarSettings,
    NK extends keyof CalendarSettings[K]
  >(
    key: K,
    nestedKey: NK,
    value: CalendarSettings[K][NK]
  ) => {
    setSettings(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [nestedKey]: value,
      },
    }));
  };

  const dayOptions = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 6, label: 'Saturday' },
  ];

  const viewOptions: { value: CalendarView; label: string; icon: React.ReactNode }[] = [
    { value: 'day', label: 'Day View', icon: <Calendar className="h-4 w-4" /> },
    { value: 'week', label: 'Week View', icon: <Calendar className="h-4 w-4" /> },
    { value: 'month', label: 'Month View', icon: <Calendar className="h-4 w-4" /> },
    { value: 'agenda', label: 'Agenda View', icon: <Calendar className="h-4 w-4" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Calendar Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="display" className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="display" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Display
            </TabsTrigger>
            <TabsTrigger value="behavior" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Behavior  
            </TabsTrigger>
            <TabsTrigger value="sync" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Sync
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Alerts
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-6">
            <TabsContent value="display" className="space-y-6 mt-0">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Default View */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Default View</CardTitle>
                    <CardDescription>
                      Choose which view opens when you visit the calendar
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup
                      value={settings.defaultView}
                      onValueChange={(value: CalendarView) => updateSetting('defaultView', value)}
                      className="grid grid-cols-2 gap-4"
                    >
                      {viewOptions.map((option) => (
                        <div key={option.value} className="flex items-center space-x-2">
                          <RadioGroupItem value={option.value} id={option.value} />
                          <Label htmlFor={option.value} className="flex items-center gap-2 cursor-pointer">
                            {option.icon}
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </CardContent>
                </Card>

                {/* Week Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Week Display</CardTitle>
                    <CardDescription>
                      Customize how weeks are displayed in your calendar
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="week-start">Week starts on</Label>
                      <Select
                        value={settings.weekStartsOn.toString()}
                        onValueChange={(value) => updateSetting('weekStartsOn', parseInt(value))}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {dayOptions.map((day) => (
                            <SelectItem key={day.value} value={day.value.toString()}>
                              {day.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="show-weekends">Show weekends</Label>
                      <Switch
                        id="show-weekends"
                        checked={settings.showWeekends}
                        onCheckedChange={(checked) => updateSetting('showWeekends', checked)}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Working Hours */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Working Hours</CardTitle>
                    <CardDescription>
                      Define your working hours for better time blocking
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="working-hours">Enable working hours</Label>
                      <Switch
                        id="working-hours"
                        checked={settings.workingHours.enabled}
                        onCheckedChange={(checked) => 
                          updateNestedSetting('workingHours', 'enabled', checked)
                        }
                      />
                    </div>

                    {settings.workingHours.enabled && (
                      <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                        <div>
                          <Label htmlFor="start-time">Start time</Label>
                          <Select
                            value={settings.workingHours.start}
                            onValueChange={(value) => 
                              updateNestedSetting('workingHours', 'start', value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }, (_, i) => {
                                const hour = i.toString().padStart(2, '0');
                                return (
                                  <SelectItem key={hour} value={`${hour}:00`}>
                                    {`${hour}:00`}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="end-time">End time</Label>
                          <Select
                            value={settings.workingHours.end}
                            onValueChange={(value) => 
                              updateNestedSetting('workingHours', 'end', value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }, (_, i) => {
                                const hour = i.toString().padStart(2, '0');
                                return (
                                  <SelectItem key={hour} value={`${hour}:00`}>
                                    {`${hour}:00`}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Visual Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Visual Options</CardTitle>
                    <CardDescription>
                      Customize the appearance of your calendar
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="color-coding">Color coding by priority</Label>
                      <Switch
                        id="color-coding"
                        checked={settings.colorCodingEnabled}
                        onCheckedChange={(checked) => updateSetting('colorCodingEnabled', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="show-completed">Show completed tasks</Label>
                      <Switch
                        id="show-completed"
                        checked={settings.showCompletedTasks}
                        onCheckedChange={(checked) => updateSetting('showCompletedTasks', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="compact-mode">Compact mode</Label>
                      <Switch
                        id="compact-mode"
                        checked={settings.compactMode}
                        onCheckedChange={(checked) => updateSetting('compactMode', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="pomodoro-counts">Show Pomodoro counts</Label>
                      <Switch
                        id="pomodoro-counts"
                        checked={settings.showPomodoroCounts}
                        onCheckedChange={(checked) => updateSetting('showPomodoroCounts', checked)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            <TabsContent value="behavior" className="space-y-6 mt-0">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Time Format</CardTitle>
                    <CardDescription>
                      Choose between 12-hour and 24-hour time format
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup
                      value={settings.timeFormat}
                      onValueChange={(value: '12h' | '24h') => updateSetting('timeFormat', value)}
                      className="flex gap-6"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="12h" id="12h" />
                        <Label htmlFor="12h" className="cursor-pointer">
                          12-hour (2:30 PM)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="24h" id="24h" />
                        <Label htmlFor="24h" className="cursor-pointer">
                          24-hour (14:30)
                        </Label>
                      </div>
                    </RadioGroup>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            <TabsContent value="sync" className="space-y-6 mt-0">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Auto Sync</CardTitle>
                    <CardDescription>
                      Automatically sync with external calendars
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="auto-sync">Enable auto sync</Label>
                      <Switch
                        id="auto-sync"
                        checked={settings.autoSync}
                        onCheckedChange={(checked) => updateSetting('autoSync', checked)}
                      />
                    </div>

                    {settings.autoSync && (
                      <div className="pt-2 border-t">
                        <Label htmlFor="sync-interval">
                          Sync interval: {settings.syncInterval} minutes
                        </Label>
                        <Slider
                          id="sync-interval"
                          min={5}
                          max={60}
                          step={5}
                          value={[settings.syncInterval]}
                          onValueChange={([value]) => updateSetting('syncInterval', value)}
                          className="mt-2"
                        />
                        <div className="flex justify-between text-sm text-muted-foreground mt-1">
                          <span>5 min</span>
                          <span>60 min</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-6 mt-0">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Notification Preferences</CardTitle>
                    <CardDescription>
                      Choose which notifications you want to receive
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="task-reminders">Task reminders</Label>
                        <p className="text-sm text-muted-foreground">
                          Get notified about upcoming tasks
                        </p>
                      </div>
                      <Switch
                        id="task-reminders"
                        checked={settings.notifications.taskReminders}
                        onCheckedChange={(checked) => 
                          updateNestedSetting('notifications', 'taskReminders', checked)
                        }
                      />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="sync-updates">Sync updates</Label>
                        <p className="text-sm text-muted-foreground">
                          Get notified when calendar sync completes
                        </p>
                      </div>
                      <Switch
                        id="sync-updates"
                        checked={settings.notifications.syncUpdates}
                        onCheckedChange={(checked) => 
                          updateNestedSetting('notifications', 'syncUpdates', checked)
                        }
                      />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="conflict-alerts">Conflict alerts</Label>
                        <p className="text-sm text-muted-foreground">
                          Get notified about scheduling conflicts
                        </p>
                      </div>
                      <Switch
                        id="conflict-alerts"
                        checked={settings.notifications.conflictAlerts}
                        onCheckedChange={(checked) => 
                          updateNestedSetting('notifications', 'conflictAlerts', checked)
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
