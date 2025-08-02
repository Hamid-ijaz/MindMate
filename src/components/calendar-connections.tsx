'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar, 
  CheckCircle, 
  AlertTriangle,
  RotateCw,
  Settings,
  Link,
  XCircle
} from 'lucide-react';
import type { ExternalCalendar, CalendarProvider } from '@/lib/types';

interface CalendarConnectionsProps {
  onConnectionChange?: (provider: CalendarProvider, connected: boolean) => void;
}

interface ConnectionStatus {
  connected: boolean;
  email?: string;
  error?: string;
  syncing?: boolean;
  lastSync?: Date;
}

export function CalendarConnections({ onConnectionChange }: CalendarConnectionsProps) {
  const [googleStatus, setGoogleStatus] = useState<ConnectionStatus>({ connected: false });
  const [outlookStatus, setOutlookStatus] = useState<ConnectionStatus>({ connected: false });
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check for OAuth callback parameters on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Handle Google OAuth callback
    if (urlParams.get('google_connected') === 'true') {
      const email = urlParams.get('google_email');
      setGoogleStatus({ connected: true, email: email || undefined });
      onConnectionChange?.('google', true);
      
      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }

    // Handle Outlook OAuth callback
    if (urlParams.get('outlook_connected') === 'true') {
      const email = urlParams.get('outlook_email');
      setOutlookStatus({ connected: true, email: email || undefined });
      onConnectionChange?.('outlook', true);
      
      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }

    // Handle OAuth errors
    const authError = urlParams.get('error');
    if (authError) {
      const message = urlParams.get('message');
      setError(`Authentication failed: ${message || authError}`);
      
      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [onConnectionChange]);

  const connectProvider = async (provider: CalendarProvider) => {
    try {
      setLoading(provider);
      setError(null);

      const response = await fetch(`/api/calendar/${provider}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'authorize' }),
      });

      if (!response.ok) {
        throw new Error(`Failed to initiate ${provider} authorization`);
      }

      const data = await response.json();
      
      if (data.authUrl) {
        // Redirect to OAuth provider
        window.location.href = data.authUrl;
      } else {
        throw new Error('No authorization URL received');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to connect to ${provider}`);
      setLoading(null);
    }
  };

  const disconnectProvider = async (provider: CalendarProvider) => {
    try {
      setLoading(provider);
      setError(null);

      const response = await fetch(`/api/calendar/${provider}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'disconnect' }),
      });

      if (!response.ok) {
        throw new Error(`Failed to disconnect ${provider}`);
      }

      // Update status
      if (provider === 'google') {
        setGoogleStatus({ connected: false });
      } else if (provider === 'outlook') {
        setOutlookStatus({ connected: false });
      }

      onConnectionChange?.(provider, false);
      setLoading(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to disconnect from ${provider}`);
      setLoading(null);
    }
  };

  const testConnection = async (provider: CalendarProvider) => {
    try {
      setLoading(`test-${provider}`);
      
      const response = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'test_connection',
          provider,
          calendarId: 'primary' 
        }),
      });

      if (!response.ok) {
        throw new Error(`Connection test failed for ${provider}`);
      }

      const data = await response.json();
      
      if (data.connected) {
        // Update last test time
        const now = new Date();
        if (provider === 'google') {
          setGoogleStatus(prev => ({ ...prev, lastSync: now }));
        } else if (provider === 'outlook') {
          setOutlookStatus(prev => ({ ...prev, lastSync: now }));
        }
      }

      setLoading(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Connection test failed for ${provider}`);
      setLoading(null);
    }
  };

  const syncCalendar = async (provider: CalendarProvider) => {
    try {
      setLoading(`sync-${provider}`);
      
      // Update syncing status
      if (provider === 'google') {
        setGoogleStatus(prev => ({ ...prev, syncing: true }));
      } else if (provider === 'outlook') {
        setOutlookStatus(prev => ({ ...prev, syncing: true }));
      }

      const response = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'sync_calendar',
          calendarIds: ['primary'] 
        }),
      });

      if (!response.ok) {
        throw new Error(`Sync failed for ${provider}`);
      }

      const data = await response.json();
      
      // Update sync status
      const now = new Date();
      if (provider === 'google') {
        setGoogleStatus(prev => ({ ...prev, syncing: false, lastSync: now }));
      } else if (provider === 'outlook') {
        setOutlookStatus(prev => ({ ...prev, syncing: false, lastSync: now }));
      }

      setLoading(null);
    } catch (err) {
      // Update syncing status on error
      if (provider === 'google') {
        setGoogleStatus(prev => ({ ...prev, syncing: false }));
      } else if (provider === 'outlook') {
        setOutlookStatus(prev => ({ ...prev, syncing: false }));
      }

      setError(err instanceof Error ? err.message : `Sync failed for ${provider}`);
      setLoading(null);
    }
  };

  const formatLastSync = (lastSync?: Date) => {
    if (!lastSync) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - lastSync.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const CalendarCard = ({ 
    provider, 
    title, 
    description, 
    status, 
    color 
  }: {
    provider: CalendarProvider;
    title: string;
    description: string;
    status: ConnectionStatus;
    color: string;
  }) => (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${color}`}>
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {status.connected ? (
              <Badge variant="default" className="text-xs bg-green-100 text-green-800 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                <XCircle className="h-3 w-3 mr-1" />
                Disconnected
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {status.connected && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            {status.email && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Account:</span>
                <span className="font-medium">{status.email}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last sync:</span>
              <span className={`font-medium ${status.syncing ? 'text-blue-600' : ''}`}>
                {status.syncing ? 'Syncing...' : formatLastSync(status.lastSync)}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center space-x-2">
          {status.connected ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => testConnection(provider)}
                disabled={loading === `test-${provider}`}
                className="flex-1"
              >
                {loading === `test-${provider}` ? (
                  <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Link className="h-4 w-4 mr-2" />
                )}
                Test
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncCalendar(provider)}
                disabled={loading === `sync-${provider}` || status.syncing}
                className="flex-1"
              >
                {loading === `sync-${provider}` || status.syncing ? (
                  <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RotateCw className="h-4 w-4 mr-2" />
                )}
                Sync
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => disconnectProvider(provider)}
                disabled={loading === provider}
              >
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              onClick={() => connectProvider(provider)}
              disabled={loading === provider}
              className="w-full"
            >
              {loading === provider ? (
                <RotateCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link className="h-4 w-4 mr-2" />
              )}
              Connect {title}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Calendar Connections</h3>
        <p className="text-sm text-muted-foreground">
          Connect your external calendars to sync tasks and events automatically.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <CalendarCard
          provider="google"
          title="Google Calendar"
          description="Sync with Google Calendar"
          status={googleStatus}
          color="bg-blue-600"
        />
        <CalendarCard
          provider="outlook"
          title="Outlook Calendar"
          description="Sync with Microsoft Outlook"
          status={outlookStatus}
          color="bg-blue-500"
        />
      </div>

      <Separator />

      <div className="space-y-4">
        <h4 className="font-medium">Sync Settings</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Auto-sync</label>
              <p className="text-xs text-muted-foreground">
                Automatically sync calendars every 5 minutes
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Two-way sync</label>
              <p className="text-xs text-muted-foreground">
                Allow changes to sync both ways
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Include completed tasks</label>
              <p className="text-xs text-muted-foreground">
                Sync completed tasks to external calendars
              </p>
            </div>
            <Switch />
          </div>
        </div>
      </div>
    </div>
  );
}
