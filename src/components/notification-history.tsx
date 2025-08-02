
"use client";

import { useNotifications } from "@/contexts/notification-context";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Bell, CheckCheck, Trash2, Loader2 } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

export function NotificationHistory() {
  // Handle case where component is rendered outside of NotificationProvider
  let notifications, unreadCount, markAllAsRead, markAsRead, clearAllNotifications;
  try {
    const context = useNotifications();
    notifications = context.notifications;
    unreadCount = context.unreadCount;
    markAllAsRead = context.markAllAsRead;
    markAsRead = context.markAsRead;
    clearAllNotifications = context.clearAllNotifications;
  } catch (error) {
    // If we're not in a provider context, return null to avoid rendering
    return null;
  }
  
  const router = useRouter();
  const [isClearing, setIsClearing] = useState(false);

  const handleNotificationClick = (notificationId: string, taskId?: string) => {
    markAsRead(notificationId);
    if (taskId) {
      router.push(`/pending?taskId=${taskId}`); 
    }
  }

  const handleClearAll = async () => {
    setIsClearing(true);
    await clearAllNotifications();
    setIsClearing(false);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 h-4 w-4 flex items-center justify-center rounded-full bg-red-500 text-white text-xs">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b">
            <h3 className="font-semibold">Notifications</h3>
            <TooltipProvider>
              <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                      <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={markAllAsRead}>
                                <CheckCheck className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Mark all as read</TooltipContent>
                      </Tooltip>
                  )}
                  {notifications.length > 0 && (
                      <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleClearAll} disabled={isClearing}>
                                {isClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Clear all notifications</TooltipContent>
                      </Tooltip>
                  )}
              </div>
            </TooltipProvider>
        </div>
        <ScrollArea className="h-96">
            {notifications.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-10">No notifications yet.</p>
            ) : (
                <div className="divide-y">
                    {notifications.map((notif) => (
                    <div
                        key={notif.id}
                        className={cn(
                        "p-3 hover:bg-secondary cursor-pointer",
                        !notif.isRead && "bg-primary/10"
                        )}
                        onClick={() => handleNotificationClick(notif.id, notif.data?.taskId)}
                    >
                        <p className="font-semibold text-sm">{notif.title}</p>
                        <p className="text-xs text-muted-foreground">{notif.body}</p>
                        <p className="text-xs text-muted-foreground/80 mt-1">
                            {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                        </p>
                    </div>
                    ))}
                </div>
            )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
