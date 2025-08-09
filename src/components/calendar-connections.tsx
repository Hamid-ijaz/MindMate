'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar, 
  CheckCircle, 
  AlertTriangle,
  RotateCw,
  Link,
  XCircle
} from 'lucide-react';
import { useGoogleCalendar } from '@/hooks/use-google-calendar';
import { useAuth } from '@/contexts/auth-context';
import { Skeleton } from '@/components/ui/skeleton';

interface CalendarConnectionsProps {
  onConnectionChange?: (provider: string, connected: boolean) => void;
}

interface GoogleCalendarSettings {
  connected: boolean;
  email?: string;
  accessToken?: string;
  refreshToken?: string;
  connectedAt?: any;
  lastSync?: any;
}

export function CalendarConnections({ onConnectionChange }: CalendarConnectionsProps) {
  const [settings, setSettings] = useState<GoogleCalendarSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { connect, disconnect, loading: googleCalendarLoading } = useGoogleCalendar();

  // Load Google Calendar settings
  const loadSettings = async () => {
    if (!user?.email) return;

    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading Google Calendar settings for:', user.email);

      const response = await fetch('/api/calendar/google/settings');
      
      console.log('API response status:', response.status);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log('No Google Calendar settings found, setting connected: false');
          setSettings({ connected: false });
          return;
        }
        throw new Error('Failed to load Google Calendar settings');
      }

      const data = await response.json();
      console.log('Received Google Calendar settings:', data);
      setSettings(data);
      onConnectionChange?.('google', data.connected);
    } catch (err) {
      console.error('Error loading Google Calendar settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load settings');
      setSettings({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [user?.email]);

  // Check URL parameters for success/error and reload settings accordingly
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const success = urlParams.get('success');
      const error = urlParams.get('error');
      
      if (success === 'google_calendar_connected') {
        console.log('Google Calendar connection success detected, reloading settings');
        setTimeout(() => {
          loadSettings();
          // Clean URL without the success parameter to remove clutter from URL
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('success');
          window.history.replaceState({}, '', newUrl.toString());
        }, 1000);
      } else if (success && success.includes('google_calendar')) {
        console.log('Google Calendar connection success variant detected:', success);
        setTimeout(() => {
          loadSettings();
          // Clean URL without the success parameter to remove clutter from URL
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('success');
          window.history.replaceState({}, '', newUrl.toString());
        }, 1000);
      } else if (error && error.includes('google_calendar')) {
        console.log('Google Calendar connection error detected:', error);
        let errorMessage = 'Failed to connect to Google Calendar.';
        
        if (error.includes('api_disabled')) {
          errorMessage = 'Google Calendar API is not enabled. The administrator needs to enable the Google Calendar API in the Google Cloud Console for this application to work properly.';
        } else if (error.includes('permission_denied')) {
          errorMessage = 'Permission denied by Google Calendar API. Please ensure the application has the necessary permissions and try again.';
        } else if (error.includes('token_expired')) {
          errorMessage = 'Authentication expired. Please disconnect and reconnect your Google Calendar.';
        } else if (error.includes('connection_failed')) {
          errorMessage = 'Google Calendar API configuration issue. Please ensure that the Google Calendar API is properly configured in the backend. Contact your administrator if this issue persists.';
        } else if (error.includes('denied')) {
          errorMessage = 'Google Calendar connection was denied. Please try again and grant the necessary permissions when prompted.';
        } else if (error.includes('auth_required')) {
          errorMessage = 'Authentication required. Please try connecting to Google Calendar again.';
        } else if (error.includes('invalid_grant')) {
          errorMessage = 'Authentication expired. Please disconnect and reconnect your Google Calendar.';
        }
        
        setError(errorMessage);
        // Clean URL without the error parameter to prevent showing error in URL
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('error');
        window.history.replaceState({}, '', newUrl.toString());
      }
    }
  }, []);

  // Force reload when component receives new key prop (calendarRefreshTrigger)
  useEffect(() => {
    if (user?.email) {
      console.log('CalendarConnections: Forced reload triggered');
      loadSettings();
    }
  }, []);  // This will run on every new component mount due to key prop

  // Also reload settings when the window comes back into focus (after OAuth redirect)
  useEffect(() => {
    const handleFocus = () => {
      if (user?.email) {
        console.log('Window focus detected - checking for calendar connection updates');
        setTimeout(() => loadSettings(), 1000); // Small delay to ensure backend has processed
      }
    };
    
    const handleVisibilityChange = () => {
      if (!document.hidden && user?.email) {
        console.log('Visibility change detected - checking for calendar connection updates');
        setTimeout(() => loadSettings(), 1000);
      }
    };
    
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.email]);

  const handleConnect = async () => {
    try {
      setError(null); // Clear any previous errors
      await connect();
      // After successful connection, wait a bit and reload settings
      setTimeout(() => {
        loadSettings();
      }, 2000);
    } catch (err) {
      console.error('Failed to connect to Google Calendar:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to Google Calendar. Please try again.');
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setSettings({ connected: false });
      onConnectionChange?.('google', false);
    } catch (err) {
      console.error('Failed to disconnect from Google Calendar:', err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <CardTitle>Google Calendar</CardTitle>
            </div>
            <CardDescription>
              Sync your tasks with Google Calendar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <div>
                <CardTitle>Google Calendar</CardTitle>
                <CardDescription>
                  Sync your tasks with Google Calendar automatically
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {settings?.connected ? (
                <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="h-3 w-3 mr-1" />
                  Not Connected
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {error}
                {error.includes('Google Calendar API is not enabled') && (
                  <div className="mt-2">
                    <p className="text-sm">This is a configuration issue that needs to be resolved by the application administrator.</p>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
          
          {settings?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <div>
                  <p className="text-sm font-medium text-green-900">Connected Account</p>
                  <p className="text-sm text-green-700">{settings.email}</p>
                  {settings.connectedAt && (
                    <p className="text-xs text-green-600 mt-1">
                      Connected {new Date(settings.connectedAt.seconds * 1000).toLocaleDateString()}
                    </p>
                  )}
                  {settings.lastSync && (
                    <p className="text-xs text-green-600">
                      Last sync: {new Date(settings.lastSync.seconds * 1000).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Calendar Sync</p>
                  <p className="text-sm text-muted-foreground">
                    Tasks with calendar sync enabled will be automatically synced
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between items-center">
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={googleCalendarLoading}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  {googleCalendarLoading ? (
                    <>
                      <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Disconnect
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center py-6">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Connect Google Calendar</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Sync your tasks with Google Calendar to keep everything in one place. 
                  Tasks with reminder dates will automatically appear in your calendar.
                </p>
                <Button
                  onClick={handleConnect}
                  disabled={googleCalendarLoading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {googleCalendarLoading ? (
                    <>
                      <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Link className="h-4 w-4 mr-2" />
                      Connect Google Calendar
                    </>
                  )}
                </Button>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>What happens when you connect:</strong>
                  <ul className="list-disc list-inside mt-2 text-sm">
                    <li>Tasks with "Sync to Google Calendar" enabled will be added to your calendar</li>
                    <li>Reminder dates and times will be synced automatically</li>
                    <li>You can open tasks directly in Google Calendar</li>
                    <li>Your calendar data is stored securely</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
