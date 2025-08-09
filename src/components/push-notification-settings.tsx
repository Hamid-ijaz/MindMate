import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, BellOff, Smartphone, TestTube, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useToast } from '@/hooks/use-toast';

interface NotificationSettingsProps {
  onClose?: () => void;
}

export function NotificationSettings({ onClose }: NotificationSettingsProps) {
  const { 
    isSupported, 
    permission, 
    subscription, 
    isLoading,
    requestPermission, 
    subscribe, 
    unsubscribe,
    testNotification 
  } = usePushNotifications();
  
  const { toast } = useToast();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    setIsSubscribed(!!subscription);
  }, [subscription]);

  const handleToggleNotifications = async () => {
    if (isSubscribed) {
      const success = await unsubscribe();
      if (success) {
        setIsSubscribed(false);
      }
    } else {
      if (permission !== 'granted') {
        const granted = await requestPermission();
        if (!granted) return;
      }
      
      const success = await subscribe();
      if (success) {
        setIsSubscribed(true);
      }
    }
  };

  const handleTestNotification = async () => {
    const success = await testNotification();
    if (success) {
      toast({
        title: "Test Sent!",
        description: "You should see a test notification shortly.",
      });
    } else {
      toast({
        title: "Test Failed",
        description: "Unable to send test notification. Check your settings.",
        variant: "destructive",
      });
    }
  };

  const getPermissionBadge = () => {
    switch (permission) {
      case 'granted':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Granted</Badge>;
      case 'denied':
        return <Badge variant="destructive"><BellOff className="w-3 h-3 mr-1" />Denied</Badge>;
      default:
        return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" />Not Set</Badge>;
    }
  };

  const getSupportStatus = () => {
    if (!isSupported) {
      return (
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Push notifications are not supported in this browser. Try using Chrome, Firefox, or Safari.
          </AlertDescription>
        </Alert>
      );
    }
    return null;
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Get notified about overdue tasks and reminders even when the app is closed.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {getSupportStatus()}
        
        {isSupported && (
          <>
            {/* Main Toggle */}
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-0.5">
                <Label htmlFor="push-notifications" className="text-base">
                  Enable Push Notifications
                </Label>
                <div className="text-sm text-muted-foreground">
                  Receive task reminders on this device
                </div>
              </div>
              <Switch
                id="push-notifications"
                checked={isSubscribed}
                onCheckedChange={handleToggleNotifications}
                disabled={isLoading}
              />
            </div>

            {/* Status Information */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Permission Status:</span>
                {getPermissionBadge()}
              </div>
              
              {subscription && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Device Status:</span>
                  <Badge variant="default" className="bg-blue-500">
                    <Smartphone className="w-3 h-3 mr-1" />
                    Subscribed
                  </Badge>
                </div>
              )}
            </div>

            {/* Test Notification */}
            {isSubscribed && (
              <div className="pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestNotification}
                  disabled={isLoading}
                  className="w-full"
                >
                  <TestTube className="w-4 h-4 mr-2" />
                  Send Test Notification
                </Button>
              </div>
            )}

            {/* Additional Information */}
            <div className="pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="w-full text-xs text-muted-foreground"
              >
                <Info className="w-3 h-3 mr-1" />
                {showDetails ? 'Hide' : 'Show'} Details
              </Button>
              
              {showDetails && (
                <div className="mt-2 p-3 bg-muted rounded-lg text-xs space-y-2">
                  <div><strong>How it works:</strong></div>
                  <ul className="space-y-1 text-muted-foreground ml-2">
                    <li>• Notifications are sent when tasks become overdue</li>
                    <li>• Daily reminders for overdue tasks (up to 7 days)</li>
                    <li>• Works even when the app is closed</li>
                    <li>• You can disable anytime in browser settings</li>
                  </ul>
                  
                  {subscription && (
                    <div className="pt-2 border-t">
                      <div><strong>Technical Info:</strong></div>
                      <div className="text-muted-foreground">
                        Endpoint: {subscription.endpoint.substring(0, 50)}...
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>

      {onClose && (
        <CardFooter>
          <Button variant="outline" onClick={onClose} className="w-full">
            Close
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
