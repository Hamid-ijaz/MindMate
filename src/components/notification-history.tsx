
"use client";

import { useNotifications } from "@/contexts/notification-context";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Bell, CheckCheck } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useTasks } from "@/contexts/task-context";
import { useRouter } from "next/navigation";

export function NotificationHistory() {
  const { notifications, unreadCount, markAllAsRead, markAsRead } = useNotifications();
  const { startEditingTask } = useTasks();
  const router = useRouter();

  const handleNotificationClick = (notificationId: string, taskId?: string) => {
    markAsRead(notificationId);
    if (taskId) {
      // Find the task's parent to navigate to the correct page
      router.push('/pending'); // Navigate to a page where the task is visible
      setTimeout(() => startEditingTask(taskId), 100); // Delay to allow navigation
    }
  }

  return (
    <Popover onOpenChange={(isOpen) => {
        if (isOpen && unreadCount > 0) {
            // Optional: Mark as read on open
            // markAllAsRead(); 
        }
    }}>
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
            {unreadCount > 0 && (
                <Button variant="link" size="sm" className="h-auto p-0" onClick={markAllAsRead}>
                    <CheckCheck className="mr-1 h-4 w-4" />
                    Mark all as read
                </Button>
            )}
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
