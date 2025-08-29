"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNotifications } from '@/contexts/notification-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Bell, 
  BellOff, 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Loader2,
  Settings,
  ExternalLink,
  Smartphone,
  Monitor
} from 'lucide-react';

export function NotificationPermissions() {
  const { permission, requestPermission } = useNotifications();
  const { toast } = useToast();
  const [isRequesting, setIsRequesting] = useState(false);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    try {
      await requestPermission();
      if (permission === 'granted') {
        toast({
          title: "Notifications Enabled",
          description: "You'll now receive notifications for important updates.",
        });
      }
    } catch (error) {
      toast({
        title: "Permission Request Failed",
        description: "Unable to request notification permissions.",
        variant: "destructive",
      });
    } finally {
      setIsRequesting(false);
    }
  };

  const getPermissionStatus = () => {
    switch (permission) {
      case 'granted':
        return {
          icon: CheckCircle,
          color: 'text-green-500',
          badge: 'Enabled',
          badgeVariant: 'default' as const,
          title: 'Notifications Enabled',
          description: 'You\'ll receive notifications for important updates and reminders.'
        };
      case 'denied':
        return {
          icon: XCircle,
          color: 'text-red-500',
          badge: 'Blocked',
          badgeVariant: 'destructive' as const,
          title: 'Notifications Blocked',
          description: 'Notifications are currently blocked. You can enable them in your browser settings.'
        };
      default:
        return {
          icon: AlertCircle,
          color: 'text-yellow-500',
          badge: 'Not Set',
          badgeVariant: 'secondary' as const,
          title: 'Permission Not Requested',
          description: 'Click the button below to enable notifications for task reminders and updates.'
        };
    }
  };

  const status = getPermissionStatus();
  const StatusIcon = status.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Browser Permissions</h1>
        <p className="text-muted-foreground mt-1">
          Manage notification permissions and browser settings.
        </p>
      </div>

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Notification Status
          </CardTitle>
          <CardDescription>
            Current browser notification permission status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <StatusIcon className={`h-6 w-6 ${status.color}`} />
              <div>
                <h3 className="font-medium">{status.title}</h3>
                <p className="text-sm text-muted-foreground">{status.description}</p>
              </div>
            </div>
            <Badge variant={status.badgeVariant}>{status.badge}</Badge>
          </div>

          {permission === 'default' && (
            <div className="pt-4">
              <Button 
                onClick={handleRequestPermission} 
                disabled={isRequesting}
                className="w-full sm:w-auto"
              >
                {isRequesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Requesting Permission...
                  </>
                ) : (
                  <>
                    <Bell className="mr-2 h-4 w-4" />
                    Enable Notifications
                  </>
                )}
              </Button>
            </div>
          )}

          {permission === 'denied' && (
            <div className="pt-4 space-y-3">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950/20 dark:border-red-900/30">
                <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">
                  Notifications are blocked
                </h4>
                <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                  To enable notifications, you'll need to change your browser settings manually.
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    toast({
                      title: "Browser Settings",
                      description: "Look for the notification icon in your address bar, or check your browser's site settings.",
                    });
                  }}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  How to Enable
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Browser Support Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Browser Support
          </CardTitle>
          <CardDescription>
            Information about notification support across different platforms.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Monitor className="h-4 w-4 text-blue-500" />
                <h3 className="font-medium">Desktop Browsers</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Full notification support in:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Chrome 22+</li>
                <li>• Firefox 22+</li>
                <li>• Safari 6+</li>
                <li>• Edge 14+</li>
              </ul>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Smartphone className="h-4 w-4 text-green-500" />
                <h3 className="font-medium">Mobile Browsers</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Limited support on mobile:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Chrome Android 42+</li>
                <li>• Firefox Mobile 22+</li>
                <li>• Safari iOS (PWA only)</li>
              </ul>
            </div>
          </div>

          <Separator />

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/20 dark:border-blue-900/30">
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
              💡 Pro Tip
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              For the best experience on mobile devices, consider installing MindMate as a Progressive Web App (PWA) from your browser's menu.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      {permission !== 'granted' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Troubleshooting
            </CardTitle>
            <CardDescription>
              Common issues and solutions for notification permissions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Notifications not working?</h4>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Check if notifications are enabled in your browser settings</li>
                  <li>• Make sure your system's "Do Not Disturb" mode is disabled</li>
                  <li>• Verify that the website isn't muted in your browser</li>
                  <li>• Try refreshing the page and requesting permission again</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">Can't see the permission prompt?</h4>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Look for a notification icon in your browser's address bar</li>
                  <li>• Check if you previously blocked notifications for this site</li>
                  <li>• Try using a different browser or incognito mode</li>
                  <li>• Clear your browser's cache and cookies</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
