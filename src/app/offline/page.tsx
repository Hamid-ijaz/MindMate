"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { WifiOff, RefreshCw, Home, CheckCircle, Database, Clock, Activity } from 'lucide-react';
import Link from 'next/link';
import { useOffline } from '@/contexts/offline-context';
import { indexedDBService } from '@/lib/indexeddb';
import { useAuth } from '@/contexts/auth-context';

export default function OfflinePage() {
  const { user } = useAuth();
  const { isOnline, isServerReachable, offlineActions, retryConnection, syncOfflineData } = useOffline();
  const [retryCount, setRetryCount] = useState(0);
  const [offlineData, setOfflineData] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const isFullyOnline = isOnline && isServerReachable;

  useEffect(() => {
    loadOfflineData();
  }, [user?.email]);

  const loadOfflineData = async () => {
    if (!user?.email) return;
    
    try {
      const [tasks, notes] = await Promise.all([
        indexedDBService.getTasks(user.email),
        indexedDBService.getNotes(user.email)
      ]);
      
      setOfflineData({ tasks, notes });
    } catch (error) {
      console.error('Failed to load offline data:', error);
    }
  };

  const handleRetry = async () => {
    setRetryCount(prev => prev + 1);
    await retryConnection();
    
    if (isFullyOnline) {
      window.location.href = '/';
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncOfflineData();
      await loadOfflineData();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  if (isFullyOnline) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-xl font-bold text-green-700">
              Back Online!
            </CardTitle>
            <CardDescription>
              Your internet connection has been restored. 
              {offlineActions.length > 0 && ' Syncing offline data...'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {offlineActions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Syncing offline actions</span>
                  <span>{offlineActions.length} pending</span>
                </div>
                <Progress value={isSyncing ? 50 : 0} className="h-2" />
                
                <Button 
                  onClick={handleSync} 
                  disabled={isSyncing}
                  variant="outline" 
                  className="w-full"
                >
                  <Activity className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </Button>
              </div>
            )}
            
            <Button onClick={handleGoHome} className="w-full">
              <Home className="mr-2 h-4 w-4" />
              Return to MindMate
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <WifiOff className="h-16 w-16 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl font-bold">
            You're Offline
          </CardTitle>
          <CardDescription>
            It looks like you've lost your internet connection. Don't worry - you can still use MindMate with your cached data!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Offline Capabilities */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span className="text-sm font-medium">View Cached Tasks</span>
              <Badge variant="secondary">
                {offlineData?.tasks?.length || 0} available
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span className="text-sm font-medium">View Cached Notes</span>
              <Badge variant="secondary">
                {offlineData?.notes?.length || 0} available
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span className="text-sm font-medium">Create New Items</span>
              <Badge variant="outline">Offline Mode</Badge>
            </div>
            {offlineActions.length > 0 && (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-orange-50 dark:bg-orange-950">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">Pending Sync</span>
                </div>
                <Badge variant="destructive">
                  {offlineActions.length} actions
                </Badge>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Button onClick={handleRetry} variant="outline" className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again {retryCount > 0 && `(${retryCount})`}
            </Button>
            
            <Button asChild className="w-full">
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Continue Offline
              </Link>
            </Button>
          </div>

          {/* Status Information */}
          <div className="text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              Your data will sync automatically when you're back online
            </p>
            
            {offlineData && (
              <div className="flex justify-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{offlineData.tasks?.length || 0} tasks</span>
                </div>
                <div className="flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  <span>{offlineData.notes?.length || 0} notes</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
