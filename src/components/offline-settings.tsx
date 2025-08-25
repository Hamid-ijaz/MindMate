'use client';

import React, { useState, useEffect } from 'react';
import { useOffline } from '@/contexts/offline-context';
import { indexedDBService } from '@/lib/indexeddb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Database, 
  HardDrive, 
  RefreshCw, 
  Trash2, 
  Download, 
  Upload,
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock,
  Wifi,
  WifiOff,
  Activity
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';

export function OfflineSettings() {
  const { user } = useAuth();
  const { 
    isOnline, 
    isServerReachable, 
    offlineActions, 
    syncOfflineData, 
    retryConnection 
  } = useOffline();
  const { toast } = useToast();

  const [storageUsage, setStorageUsage] = useState<any>(null);
  const [offlineEnabled, setOfflineEnabled] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [cacheImages, setCacheImages] = useState(true);
  const [maxCacheSize, setMaxCacheSize] = useState(50); // MB
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  const isFullyOnline = isOnline && isServerReachable;

  // Load storage usage and settings
  useEffect(() => {
    loadStorageInfo();
    loadSettings();
  }, []);

  const loadStorageInfo = async () => {
    try {
      const usage = await indexedDBService.getStorageUsage();
      setStorageUsage(usage);
    } catch (error) {
      console.error('Failed to load storage info:', error);
    }
  };

  const loadSettings = () => {
    try {
      const settings = localStorage.getItem('mindmate_offline_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        setOfflineEnabled(parsed.offlineEnabled ?? true);
        setAutoSync(parsed.autoSync ?? true);
        setCacheImages(parsed.cacheImages ?? true);
        setMaxCacheSize(parsed.maxCacheSize ?? 50);
      }
      
      const lastSync = localStorage.getItem('mindmate_last_sync');
      if (lastSync) {
        setLastSyncTime(parseInt(lastSync));
      }
    } catch (error) {
      console.error('Failed to load offline settings:', error);
    }
  };

  const saveSettings = () => {
    try {
      const settings = {
        offlineEnabled,
        autoSync,
        cacheImages,
        maxCacheSize,
      };
      localStorage.setItem('mindmate_offline_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save offline settings:', error);
    }
  };

  useEffect(() => {
    saveSettings();
  }, [offlineEnabled, autoSync, cacheImages, maxCacheSize]);

  const handleClearCache = async () => {
    if (!confirm('This will clear all offline data. Are you sure?')) return;
    
    setIsLoading(true);
    try {
      await indexedDBService.clearCache();
      await loadStorageInfo();
      toast({
        title: "Cache cleared",
        description: "All cached data has been removed.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear cache.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncOfflineData();
      setLastSyncTime(Date.now());
      localStorage.setItem('mindmate_last_sync', Date.now().toString());
      await loadStorageInfo();
      toast({
        title: "Sync completed",
        description: "All offline data has been synchronized.",
      });
    } catch (error) {
      toast({
        title: "Sync failed",
        description: "Failed to sync offline data.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportData = async () => {
    if (!user?.email) return;
    
    setIsLoading(true);
    try {
      const data = await indexedDBService.exportData(user.email);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mindmate-offline-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Data exported",
        description: "Your offline data has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export offline data.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getStoragePercentage = () => {
    if (!storageUsage) return 0;
    const totalItems = storageUsage.total;
    const maxItems = 1000; // Estimated max for visual representation
    return Math.min((totalItems / maxItems) * 100, 100);
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Connection Status
          </CardTitle>
          <CardDescription>
            Monitor your app's connectivity and sync status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Wifi className={cn('h-4 w-4', isOnline ? 'text-green-500' : 'text-red-500')} />
                <span className="text-sm font-medium">Network</span>
              </div>
              <Badge variant={isOnline ? 'default' : 'destructive'}>
                {isOnline ? 'Connected' : 'Offline'}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Database className={cn('h-4 w-4', isServerReachable ? 'text-green-500' : 'text-red-500')} />
                <span className="text-sm font-medium">Server</span>
              </div>
              <Badge variant={isServerReachable ? 'default' : 'destructive'}>
                {isServerReachable ? 'Available' : 'Unreachable'}
              </Badge>
            </div>
          </div>
          
          {lastSyncTime && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Last sync: {formatTime(lastSyncTime)}
            </div>
          )}
          
          <div className="flex gap-2">
            <Button
              onClick={retryConnection}
              disabled={isFullyOnline}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Test Connection
            </Button>
            
            <Button
              onClick={handleSync}
              disabled={!isFullyOnline || isSyncing || offlineActions.length === 0}
              size="sm"
            >
              <Activity className={cn('h-4 w-4 mr-2', isSyncing && 'animate-spin')} />
              Sync Now ({offlineActions.length})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Offline Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Offline Settings
          </CardTitle>
          <CardDescription>
            Configure how the app behaves when offline
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Enable Offline Mode</div>
                <div className="text-xs text-muted-foreground">
                  Allow the app to work without internet connection
                </div>
              </div>
              <Switch
                checked={offlineEnabled}
                onCheckedChange={setOfflineEnabled}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Auto Sync</div>
                <div className="text-xs text-muted-foreground">
                  Automatically sync data when connection is restored
                </div>
              </div>
              <Switch
                checked={autoSync}
                onCheckedChange={setAutoSync}
                disabled={!offlineEnabled}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Cache Images</div>
                <div className="text-xs text-muted-foreground">
                  Download images for offline viewing
                </div>
              </div>
              <Switch
                checked={cacheImages}
                onCheckedChange={setCacheImages}
                disabled={!offlineEnabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Storage Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Storage Usage
          </CardTitle>
          <CardDescription>
            Monitor offline data storage and manage cache
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {storageUsage && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Storage Used</span>
                  <span>{storageUsage.total} items</span>
                </div>
                <Progress value={getStoragePercentage()} className="h-2" />
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tasks</span>
                    <span>{storageUsage.tasks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Notes</span>
                    <span>{storageUsage.notes}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Actions</span>
                    <span>{storageUsage.actions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cache</span>
                    <span>{storageUsage.cache}</span>
                  </div>
                </div>
              </div>
            </>
          )}
          
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleClearCache}
              variant="outline"
              size="sm"
              disabled={isLoading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Cache
            </Button>
            
            <Button
              onClick={handleExportData}
              variant="outline"
              size="sm"
              disabled={isLoading || !user?.email}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pending Actions */}
      {offlineActions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Pending Sync Actions
            </CardTitle>
            <CardDescription>
              Actions waiting to be synchronized with the server
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {offlineActions.slice(0, 5).map((action, index) => (
                <div
                  key={action.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg transition-opacity duration-200"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1 bg-orange-100 dark:bg-orange-900 rounded">
                      <Clock className="h-3 w-3 text-orange-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {action.type.replace('_', ' ').toLowerCase()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(action.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {action.type}
                  </Badge>
                </div>
              ))}
              
              {offlineActions.length > 5 && (
                <div className="text-center text-sm text-muted-foreground">
                  and {offlineActions.length - 5} more actions...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
