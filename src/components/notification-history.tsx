'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Bell, CheckCircle, X, AlertTriangle, Calendar, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatDistanceToNow } from 'date-fns';

interface NotificationEvent {
  id: string;
  type: 'overdue' | 'reminder' | 'daily-digest' | 'weekly-report';
  title: string;
  message: string;
  timestamp: Date;
  taskId?: string;
  isRead: boolean;
  metadata?: {
    taskCount?: number;
    completionRate?: number;
    streakDays?: number;
  };
}

export function NotificationHistory() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      loadNotificationHistory();
    }
  }, [user]);

  const loadNotificationHistory = async () => {
    if (!user?.email) return;
    
    try {
      // Since we don't have a history API yet, we'll simulate with recent activity
      // This would normally fetch from /api/notifications/history
      const mockNotifications: NotificationEvent[] = [
        {
          id: '1',
          type: 'overdue',
          title: 'Overdue Tasks Alert',
          message: 'You have 3 overdue tasks that need attention',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          isRead: false,
          metadata: { taskCount: 3 }
        },
        {
          id: '2',
          type: 'reminder',
          title: 'Task Reminder',
          message: 'Complete project presentation is due in 15 minutes',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
          taskId: 'task-123',
          isRead: true
        },
        {
          id: '3',
          type: 'daily-digest',
          title: 'Daily Progress Summary',
          message: 'You completed 5 out of 8 tasks today. Great progress!',
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
          isRead: true,
          metadata: { taskCount: 8, completionRate: 62.5 }
        }
      ];
      
      setNotifications(mockNotifications);
    } catch (error) {
      console.error('Failed to load notification history:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, isRead: true } : n
      )
    );
    
    // Would normally call API to mark as read
    // await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST' });
  };

  const clearHistory = async () => {
    setNotifications([]);
    // Would normally call API to clear history
    // await fetch('/api/notifications/history', { method: 'DELETE' });
  };

  const getNotificationIcon = (type: NotificationEvent['type'], isRead: boolean) => {
    const className = `h-4 w-4 ${isRead ? 'text-muted-foreground' : 'text-primary'}`;
    
    switch (type) {
      case 'overdue':
        return <AlertTriangle className={className} />;
      case 'reminder':
        return <Bell className={className} />;
      case 'daily-digest':
        return <Calendar className={className} />;
      case 'weekly-report':
        return <CheckCircle className={className} />;
      default:
        return <Bell className={className} />;
    }
  };

  const getNotificationBadge = (type: NotificationEvent['type']) => {
    switch (type) {
      case 'overdue':
        return <Badge variant="destructive" className="text-xs">Overdue</Badge>;
      case 'reminder':
        return <Badge variant="default" className="text-xs">Reminder</Badge>;
      case 'daily-digest':
        return <Badge variant="secondary" className="text-xs">Daily</Badge>;
      case 'weekly-report':
        return <Badge variant="outline" className="text-xs">Weekly</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notification History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center space-x-3 animate-pulse">
                <div className="w-8 h-8 bg-muted rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              </div>
            ))}
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
              <Clock className="h-5 w-5" />
              Notification History
            </CardTitle>
            <CardDescription>
              Recent push notifications sent to your devices
            </CardDescription>
          </div>
          {notifications.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearHistory}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {notifications.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No notifications yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Enable push notifications to see your notification history here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification, index) => (
              <div key={notification.id}>
                <div
                  className={`flex items-start space-x-3 p-3 rounded-lg transition-colors ${
                    !notification.isRead 
                      ? 'bg-primary/5 border border-primary/20' 
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type, notification.isRead)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h4 className={`text-sm font-medium ${
                          !notification.isRead ? 'text-foreground' : 'text-muted-foreground'
                        }`}>
                          {notification.title}
                        </h4>
                        {getNotificationBadge(notification.type)}
                      </div>
                      {!notification.isRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsRead(notification.id)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-2">
                      {notification.message}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                        </span>
                        
                        {notification.metadata && (
                          <>
                            {notification.metadata.taskCount && (
                              <span className="flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                {notification.metadata.taskCount} tasks
                              </span>
                            )}
                            {notification.metadata.completionRate && (
                              <span className="flex items-center gap-1">
                                <CheckCircle className="h-3 w-3 text-green-500" />
                                {notification.metadata.completionRate}% complete
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      
                      {notification.taskId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 text-xs text-primary hover:text-primary/80"
                        >
                          View Task
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                
                {index < notifications.length - 1 && <Separator className="my-2" />}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
