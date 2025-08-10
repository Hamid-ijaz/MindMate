'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useUnifiedNotifications } from '@/contexts/unified-notification-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, TestTube, Trash2, CheckCircle, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function NotificationTestPanel() {
  const { user } = useAuth();
  const {
    notifications,
    unreadCount,
    isLoading,
    sendInAppNotification,
    markAllAsRead,
    clearAllNotifications,
    refreshStats,
  } = useUnifiedNotifications();
  const [testLoading, setTestLoading] = useState(false);

  const handleCreateTestNotification = async () => {
    if (!user?.email) return;
    
    setTestLoading(true);
    try {
      await sendInAppNotification(
        'Test Notification 🧪',
        'This is a test notification to verify the unified notification system is working correctly!',
        {
          type: 'system',
          metadata: {
            isTest: true,
            timestamp: Date.now(),
          },
        }
      );
    } catch (error) {
      console.error('Failed to create test notification:', error);
    }
    setTestLoading(false);
  };

  const handleCreateTestViaAPI = async () => {
    if (!user?.email) return;
    
    setTestLoading(true);
    try {
      const response = await fetch('/api/notifications/test-in-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: user.email,
          title: 'API Test Notification 🚀',
          body: 'This test notification was created via the API endpoint to test the Firestore → UI workflow!',
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'API test failed');
      }
      
      console.log('API test notification created:', result);
    } catch (error) {
      console.error('Failed to create API test notification:', error);
    }
    setTestLoading(false);
  };

  if (!user) {
    return (
      <Card className="w-full max-w-2xl">
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">
            Please log in to test the notification system.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Test Panel
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount} unread</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Test Controls */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleCreateTestNotification}
            disabled={testLoading}
            size="sm"
          >
            <TestTube className="h-4 w-4 mr-2" />
            Test In-App
          </Button>
          
          <Button
            onClick={handleCreateTestViaAPI}
            disabled={testLoading}
            variant="outline"
            size="sm"
          >
            <TestTube className="h-4 w-4 mr-2" />
            Test API
          </Button>
          
          <Button
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            variant="secondary"
            size="sm"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Mark All Read
          </Button>
          
          <Button
            onClick={refreshStats}
            disabled={isLoading}
            variant="ghost"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Button
            onClick={clearAllNotifications}
            disabled={notifications.length === 0}
            variant="destructive"
            size="sm"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        </div>

        {/* Status */}
        <div className="text-sm text-muted-foreground">
          Total: {notifications.length} notifications | 
          Unread: {unreadCount} | 
          Status: {isLoading ? 'Loading...' : 'Ready'}
        </div>

        {/* Notifications List */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No notifications yet</p>
              <p className="text-xs">Create a test notification to see it here</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 rounded-lg border ${
                  !notification.isRead ? 'bg-primary/5 border-primary/20' : 'bg-muted/20'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-medium ${
                      !notification.isRead ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                      {notification.title}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {notification.body}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span>{(() => {
                        const date = new Date(notification.createdAt);
                        return date instanceof Date && !isNaN(date.getTime())
                          ? formatDistanceToNow(date, { addSuffix: true })
                          : 'Unknown';
                      })()}</span>
                      <Badge variant="outline" className="text-xs py-0 px-1">
                        {notification.type}
                      </Badge>
                      {notification.data?.type && (
                        <Badge variant="outline" className="text-xs py-0 px-1">
                          {notification.data.type}
                        </Badge>
                      )}
                      {!notification.isRead && (
                        <Badge variant="destructive" className="text-xs py-0 px-1">
                          NEW
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}