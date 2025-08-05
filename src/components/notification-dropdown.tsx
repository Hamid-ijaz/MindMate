'use client';

import React, { useState, useEffect } from 'react';
import { Bell, BellRing, X, AlertTriangle, Calendar, CheckCircle, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useNotifications } from '@/contexts/notification-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
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

export function NotificationDropdown() {
  const { user } = useAuth();
  const { notifications, deleteNotification } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Convert notifications from context to dropdown format
  const dropdownNotifications: NotificationEvent[] = notifications.map(notif => ({
    id: notif.id,
    type: notif.data?.type === 'task-overdue' ? 'overdue' : 
          notif.data?.type === 'task-reminder' ? 'reminder' : 
          notif.title.toLowerCase().includes('overdue') ? 'overdue' :
          notif.title.toLowerCase().includes('digest') ? 'daily-digest' :
          'reminder',
    title: notif.title,
    message: notif.body || '',
    timestamp: new Date(notif.createdAt),
    taskId: notif.data?.taskId,
    isRead: notif.isRead,
    metadata: notif.data ? {
      taskCount: notif.data.taskCount,
      completionRate: notif.data.completionRate
    } : undefined
  }));

  const markAsRead = async (notificationId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    // Update the notification as read in the context
    await deleteNotification(notificationId);
  };

  const clearHistory = async () => {
    // Clear all notifications
    for (const notification of dropdownNotifications) {
      await deleteNotification(notification.id);
    }
    setIsOpen(false);
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

  const unreadCount = dropdownNotifications.filter(n => !n.isRead).length;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-9 w-9 p-0">
          {unreadCount > 0 ? (
            <BellRing className="h-4 w-4" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs flex items-center justify-center"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="end" 
        className="w-80 max-h-96 overflow-hidden"
        sideOffset={5}
      >
        <DropdownMenuLabel className="flex items-center justify-between py-2">
          <span className="font-semibold">Notifications</span>
          {dropdownNotifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearHistory}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear All
            </Button>
          )}
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        {loading ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center space-x-3 animate-pulse p-2">
                <div className="w-8 h-8 bg-muted rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted rounded w-3/4"></div>
                  <div className="h-2 bg-muted rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : dropdownNotifications.length === 0 ? (
          <div className="text-center py-8 px-4">
            <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No notifications yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Enable push notifications in settings
            </p>
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto pr-1" style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'hsl(var(--muted-foreground)) transparent',
          }}>
            <style jsx>{`
              div::-webkit-scrollbar {
                width: 6px;
              }
              div::-webkit-scrollbar-track {
                background: transparent;
              }
              div::-webkit-scrollbar-thumb {
                background-color: hsl(var(--muted-foreground) / 0.3);
                border-radius: 3px;
              }
              div::-webkit-scrollbar-thumb:hover {
                background-color: hsl(var(--muted-foreground) / 0.5);
              }
            `}</style>
            {dropdownNotifications.map((notification, index) => (
              <div key={notification.id}>
                <DropdownMenuItem
                  className={`flex items-start p-3 cursor-pointer ${
                    !notification.isRead 
                      ? 'bg-primary/5 border-l-2 border-primary' 
                      : ''
                  }`}
                  onClick={() => {
                    if (notification.taskId) {
                      window.location.href = `/task/${notification.taskId}`;
                    }
                  }}
                >
                  <div className="flex-shrink-0 mt-1 mr-3">
                    {getNotificationIcon(notification.type, notification.isRead)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className={`text-sm font-medium line-clamp-1 ${
                        !notification.isRead ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {notification.title}
                      </h4>
                      {!notification.isRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => markAsRead(notification.id, e)}
                          className="h-5 w-5 p-0 ml-2 flex-shrink-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {notification.message}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                      </span>
                      
                      {notification.metadata && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {notification.metadata.taskCount && (
                            <span className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              {notification.metadata.taskCount}
                            </span>
                          )}
                          {notification.metadata.completionRate && (
                            <span className="text-green-600">
                              {notification.metadata.completionRate}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </DropdownMenuItem>
                
                {index < dropdownNotifications.length - 1 && <DropdownMenuSeparator />}
              </div>
            ))}
          </div>
        )}
        
        {dropdownNotifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-primary hover:text-primary/80"
                onClick={() => {
                  window.location.href = '/settings';
                  setIsOpen(false);
                }}
              >
                View All Settings
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
