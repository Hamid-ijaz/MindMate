'use client';

import React, { useState } from 'react';
import { Bell, Settings, History, TrendingUp, Clock, Users, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotificationSettings } from './notification-settings';
import { NotificationHistory } from './notification-history';
import { NotificationPrompt } from './notification-prompt';
import { Badge } from '@/components/ui/badge';
import { useNotificationManager } from '@/hooks/use-notification-manager';

interface NotificationStats {
  totalSent: number;
  totalReceived: number;
  openRate: number;
  averageResponseTime: string;
  mostActiveDay: string;
  popularNotificationType: string;
}

export function NotificationDashboard() {
  const {
    isSupported,
    permission,
    isSubscribed,
    preferences,
    isLoading,
    shouldShowPrompt
  } = useNotificationManager();

  const [showPrompt, setShowPrompt] = useState(shouldShowPrompt());

  // Mock stats - in a real app, these would come from analytics API
  const stats: NotificationStats = {
    totalSent: 247,
    totalReceived: 198,
    openRate: 87.5,
    averageResponseTime: '2.3 minutes',
    mostActiveDay: 'Monday',
    popularNotificationType: 'Task Reminders'
  };

  if (!isSupported) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Push Notifications
            </CardTitle>
            <CardDescription>
              Manage your push notification preferences and settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Bell className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Notifications Not Supported</h3>
              <p className="text-muted-foreground mb-4">
                Your browser doesn't support push notifications. Please use a modern browser like Chrome, Firefox, or Safari.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notification Prompt */}
      {showPrompt && (
        <NotificationPrompt
          onDismiss={() => setShowPrompt(false)}
          onSubscribed={() => setShowPrompt(false)}
        />
      )}

      {/* Overview Stats */}
      {isSubscribed && preferences?.enabled && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Notifications Sent</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSent}</div>
              <p className="text-xs text-muted-foreground">
                This month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.openRate}%</div>
              <p className="text-xs text-muted-foreground">
                +12% from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Response Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageResponseTime}</div>
              <p className="text-xs text-muted-foreground">
                Average response
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Most Popular</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold text-primary">{stats.popularNotificationType}</div>
              <p className="text-xs text-muted-foreground">
                Notification type
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Push Notifications
            {isSubscribed && (
              <Badge variant="secondary" className="ml-2">
                <Zap className="h-3 w-3 mr-1" />
                Active
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Manage your push notification preferences, view history, and track performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="settings" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                History
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Analytics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="mt-6">
              <NotificationSettings />
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <NotificationHistory />
            </TabsContent>

            <TabsContent value="analytics" className="mt-6">
              <div className="space-y-6">
                {/* Performance Metrics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Performance Metrics
                    </CardTitle>
                    <CardDescription>
                      Insights into your notification engagement and effectiveness
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Total Sent</span>
                          <span className="text-sm text-muted-foreground">{stats.totalSent}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="bg-primary h-2 rounded-full" style={{ width: '100%' }}></div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Delivered</span>
                          <span className="text-sm text-muted-foreground">{stats.totalReceived}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(stats.totalReceived / stats.totalSent) * 100}%` }}></div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Open Rate</span>
                          <span className="text-sm text-muted-foreground">{stats.openRate}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${stats.openRate}%` }}></div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Response Time</span>
                          <span className="text-sm text-muted-foreground">{stats.averageResponseTime}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="bg-purple-500 h-2 rounded-full" style={{ width: '75%' }}></div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Usage Patterns */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Usage Patterns
                    </CardTitle>
                    <CardDescription>
                      When and how you interact with notifications
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h4 className="font-medium">Most Active Day</h4>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{stats.mostActiveDay}</Badge>
                          <span className="text-sm text-muted-foreground">
                            You receive the most notifications on {stats.mostActiveDay}s
                          </span>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-medium">Popular Notification Type</h4>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{stats.popularNotificationType}</Badge>
                          <span className="text-sm text-muted-foreground">
                            Your most common notification type
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
