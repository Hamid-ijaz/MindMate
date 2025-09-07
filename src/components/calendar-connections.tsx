'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  CheckSquare, 
  CheckCircle, 
  AlertTriangle,
  RotateCw,
  Link,
  XCircle,
  ArrowLeftRight,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Skeleton } from '@/components/ui/skeleton';

interface GoogleTasksConnectionsProps {
  onConnectionChange?: (provider: string, connected: boolean) => void;
}

interface GoogleTasksSettings {
  isConnected: boolean;
  syncEnabled: boolean;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  lastSyncAt?: number;
  defaultTaskListId?: string;
  syncDirection: 'app-to-google' | 'google-to-app' | 'bidirectional';
  autoSync: boolean;
  lastError?: string;
}

export function GoogleTasksConnections({ onConnectionChange }: GoogleTasksConnectionsProps) {
  const [settings, setSettings] = useState<GoogleTasksSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const { user } = useAuth();

  // Load Google Tasks settings
  const loadSettings = async () => {
    if (!user?.email) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/google/sync');
      if (!response.ok) {
        throw new Error(`Failed to load settings: ${response.statusText}`);
      }
      
      const data = await response.json();
      setSettings(data);
    } catch (err) {
      console.error('Error loading Google Tasks settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  // Connect to Google Tasks
  const connectGoogleTasks = async () => {
    try {
      setError(null);
      window.location.href = '/api/google/oauth';
    } catch (err) {
      console.error('Error connecting to Google Tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
    }
  };

  // Disconnect from Google Tasks
  const disconnectGoogleTasks = async () => {
    try {
      setError(null);
      
      const response = await fetch('/api/google/sync', {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to disconnect: ${response.statusText}`);
      }
      
      await loadSettings();
      onConnectionChange?.('google-tasks', false);
    } catch (err) {
      console.error('Error disconnecting Google Tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  };

  // Trigger manual sync
  const triggerSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      
      const response = await fetch('/api/google/sync', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to sync: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success && result.errors?.length > 0) {
        setError(`Sync completed with errors: ${result.errors.join(', ')}`);
      }
      
      await loadSettings();
    } catch (err) {
      console.error('Error syncing tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to sync');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [user?.email]);

  // Handle URL parameters (success/error from OAuth callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');
    
    if (success === 'google_tasks_connected') {
      loadSettings();
      onConnectionChange?.('google-tasks', true);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    if (error) {
      const message = params.get('message') || 'Connection failed';
      setError(decodeURIComponent(message));
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Google Tasks Integration
          </CardTitle>
          <CardDescription>
            Sync your tasks with Google Tasks for seamless cross-platform access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    );
  }

  const getSyncDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'app-to-google': return <ArrowRight className="h-4 w-4" />;
      case 'google-to-app': return <ArrowLeft className="h-4 w-4" />;
      case 'bidirectional': return <ArrowLeftRight className="h-4 w-4" />;
      default: return <ArrowLeftRight className="h-4 w-4" />;
    }
  };

  const getSyncDirectionLabel = (direction: string) => {
    switch (direction) {
      case 'app-to-google': return 'App → Google Tasks';
      case 'google-to-app': return 'Google Tasks → App';
      case 'bidirectional': return 'Two-way sync';
      default: return 'Two-way sync';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5" />
          Google Tasks Integration
        </CardTitle>
        <CardDescription>
          Sync your tasks with Google Tasks for seamless cross-platform access
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckSquare className="h-8 w-8 text-blue-600" />
            <div>
              <h3 className="font-medium">Google Tasks</h3>
              <p className="text-sm text-muted-foreground">
                {settings?.isConnected ? 'Connected and ready to sync' : 'Not connected'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {settings?.isConnected && (
              <Badge 
                variant={
                  settings.syncStatus === 'success' ? 'default' :
                  settings.syncStatus === 'error' ? 'destructive' :
                  settings.syncStatus === 'syncing' ? 'secondary' : 'outline'
                }
                className="flex items-center gap-1"
              >
                {settings.syncStatus === 'syncing' ? (
                  <RotateCw className="h-3 w-3 animate-spin" />
                ) : settings.syncStatus === 'success' ? (
                  <CheckCircle className="h-3 w-3" />
                ) : settings.syncStatus === 'error' ? (
                  <XCircle className="h-3 w-3" />
                ) : null}
                {settings.syncStatus}
              </Badge>
            )}
            
            {settings?.isConnected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={disconnectGoogleTasks}
              >
                Disconnect
              </Button>
            ) : (
              <Button
                onClick={connectGoogleTasks}
                className="flex items-center gap-2"
              >
                <Link className="h-4 w-4" />
                Connect
              </Button>
            )}
          </div>
        </div>

        {settings?.isConnected && (
          <>
            <Separator />
            
            {/* Sync Settings */}
            <div className="space-y-4">
              <h4 className="font-medium">Sync Settings</h4>
              
              {/* Sync Direction */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Sync Direction</label>
                  <p className="text-xs text-muted-foreground">
                    Choose how tasks are synchronized
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getSyncDirectionIcon(settings.syncDirection)}
                  <span className="text-sm">{getSyncDirectionLabel(settings.syncDirection)}</span>
                </div>
              </div>

              {/* Auto Sync Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Auto Sync</label>
                  <p className="text-xs text-muted-foreground">
                    Automatically sync changes in real-time
                  </p>
                </div>
                <Switch
                  checked={settings.autoSync}
                  disabled // TODO: Implement auto sync toggle
                />
              </div>

              {/* Manual Sync */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Manual Sync</label>
                  <p className="text-xs text-muted-foreground">
                    {settings.lastSyncAt 
                      ? `Last synced: ${new Date(settings.lastSyncAt).toLocaleDateString()}`
                      : 'Never synced'
                    }
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={triggerSync}
                  disabled={syncing || settings.syncStatus === 'syncing'}
                  className="flex items-center gap-2"
                >
                  <RotateCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </Button>
              </div>
            </div>

            {settings.lastError && (
              <>
                <Separator />
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Last Error:</strong> {settings.lastError}
                  </AlertDescription>
                </Alert>
              </>
            )}
          </>
        )}

        {/* Info */}
        <div className="rounded-lg bg-muted p-3">
          <p className="text-sm text-muted-foreground">
            <strong>What this does:</strong> Connects your app with Google Tasks to keep your tasks 
            synchronized across all your devices. Changes made in either place will be reflected in both.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

