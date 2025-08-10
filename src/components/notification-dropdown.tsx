'use client';

import React, { useState } from 'react';
import { Bell, BellRing, X, AlertTriangle, Calendar, CheckCircle, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useUnifiedNotifications } from '@/contexts/unified-notification-context';
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
import { motion, AnimatePresence } from 'framer-motion';
import type { NotificationDocument } from '@/lib/types';

interface NotificationEvent {
  id: string;
  type: 'overdue' | 'reminder' | 'daily-digest' | 'weekly-report' | 'system';
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
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    markAsRead, 
    deleteNotification, 
    clearAllNotifications 
  } = useUnifiedNotifications();
  const [isOpen, setIsOpen] = useState(false);

  // Convert Firestore notifications to dropdown format
  const dropdownNotifications: NotificationEvent[] = notifications.map(notif => ({
    id: notif.id,
    type: notif.data?.type === 'task-overdue' ? 'overdue' : 
          notif.data?.type === 'task-reminder' ? 'reminder' : 
          notif.title.toLowerCase().includes('overdue') ? 'overdue' :
          notif.title.toLowerCase().includes('digest') ? 'daily-digest' :
          notif.title.toLowerCase().includes('system') ? 'system' :
          'reminder',
    title: notif.title,
    message: notif.body || '',
    timestamp: new Date(notif.createdAt),
    taskId: notif.relatedTaskId || notif.data?.taskId,
    isRead: notif.isRead,
    metadata: notif.data ? {
      taskCount: notif.data.taskCount,
      completionRate: notif.data.completionRate,
      streakDays: notif.data.streakDays
    } : undefined
  }));

  const handleMarkAsRead = async (notificationId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    await markAsRead(notificationId);
  };

  const handleDeleteNotification = async (notificationId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    await deleteNotification(notificationId);
  };

  const handleClearAll = async () => {
    await clearAllNotifications();
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
      case 'system':
        return <CheckCircle className={className} />;
      default:
        return <Bell className={className} />;
    }
  };

  const handleNotificationClick = async (notification: NotificationEvent) => {
    // Mark as read when clicked
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    // Handle navigation
    if (notification.taskId) {
      // Check if we can navigate to the task or if it was deleted
      try {
        window.location.href = `/task/${notification.taskId}`;
      } catch (error) {
        console.warn('Task may have been deleted:', notification.taskId);
        // Could show a toast here about the task being deleted
      }
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-9 w-9 p-0">
          <motion.div
            animate={unreadCount > 0 ? { rotate: [0, -10, 10, -10, 0] } : {}}
            transition={{ duration: 0.5, repeat: unreadCount > 0 ? Infinity : 0, repeatDelay: 3 }}
          >
            {unreadCount > 0 ? (
              <BellRing className="h-4 w-4" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
          </motion.div>
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1"
              >
                <Badge 
                  variant="destructive" 
                  className="h-5 w-5 p-0 text-xs flex items-center justify-center animate-pulse"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="end" 
        className="w-80 md:w-96 max-h-[80vh] md:max-h-96 overflow-hidden"
        sideOffset={5}
      >
        <DropdownMenuLabel className="flex items-center justify-between py-2">
          <span className="font-semibold">Notifications</span>
          {dropdownNotifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear All
            </Button>
          )}
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        {isLoading ? (
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
              Your task reminders and updates will appear here
            </p>
          </div>
        ) : (
          <div className="max-h-64 md:max-h-80 overflow-y-auto pr-1" style={{
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
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
              >
                <DropdownMenuItem
                  className={`flex items-start p-3 cursor-pointer transition-all duration-200 hover:bg-accent/50 ${
                    !notification.isRead 
                      ? 'bg-primary/5 border-l-2 border-primary' 
                      : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
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
                      <div className="flex items-center ml-2 space-x-1">
                        <AnimatePresence>
                          {!notification.isRead && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => handleMarkAsRead(notification.id, e)}
                                className="h-5 w-5 p-0 flex-shrink-0 hover:bg-green-100 hover:text-green-600 transition-colors duration-200"
                              >
                                <CheckCircle className="h-3 w-3" />
                              </Button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDeleteNotification(notification.id, e)}
                          className="h-5 w-5 p-0 flex-shrink-0 hover:bg-red-100 hover:text-red-600 transition-colors duration-200"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
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
              </motion.div>
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
