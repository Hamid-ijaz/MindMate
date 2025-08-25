'use client';

import React, { useState, useEffect } from 'react';
import { useOffline } from '@/contexts/offline-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Wifi, 
  WifiOff, 
  Cloud, 
  CloudOff, 
  RotateCcw, 
  CheckCircle, 
  Clock,
  AlertTriangle,
  Activity,
  Database,
  Smartphone
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfflineStatusProps {
  className?: string;
  variant?: 'full' | 'minimal' | 'badge-only';
  showSyncButton?: boolean;
}

export function OfflineStatus({ 
  className,
  variant = 'minimal',
  showSyncButton = true
}: OfflineStatusProps) {
  const { 
    isOnline, 
    isServerReachable, 
    lastOfflineTime, 
    offlineActions,
    retryConnection,
    syncOfflineData
  } = useOffline();

  const [isRetrying, setIsRetrying] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  const isFullyOnline = isOnline && isServerReachable;
  const hasOfflineActions = offlineActions.length > 0;

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await retryConnection();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncOfflineData();
      setLastSyncTime(Date.now());
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusInfo = () => {
    if (isFullyOnline) {
      return {
        status: 'online',
        label: 'Online',
        description: 'All features available',
        icon: isOnline ? Cloud : Wifi,
        color: 'text-green-500',
        bgColor: 'bg-green-50 dark:bg-green-950',
        borderColor: 'border-green-200 dark:border-green-800'
      };
    } else if (isOnline && !isServerReachable) {
      return {
        status: 'server-offline',
        label: 'Server Offline',
        description: 'Working with cached data',
        icon: CloudOff,
        color: 'text-orange-500',
        bgColor: 'bg-orange-50 dark:bg-orange-950',
        borderColor: 'border-orange-200 dark:border-orange-800'
      };
    } else {
      return {
        status: 'offline',
        label: 'Offline',
        description: 'Limited functionality',
        icon: WifiOff,
        color: 'text-red-500',
        bgColor: 'bg-red-50 dark:bg-red-950',
        borderColor: 'border-red-200 dark:border-red-800'
      };
    }
  };

  const statusInfo = getStatusInfo();

  const formatOfflineTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    if (hours > 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    if (minutes > 0) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    return 'Just now';
  };

  if (variant === 'badge-only') {
    return (
      <Badge 
        variant={isFullyOnline ? 'default' : 'destructive'}
        className={cn('flex items-center gap-1', className)}
      >
        <statusInfo.icon className="h-3 w-3" />
        {statusInfo.label}
        {hasOfflineActions && (
          <span className="ml-1 text-xs">({offlineActions.length})</span>
        )}
      </Badge>
    );
  }

  if (variant === 'minimal') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className={cn('flex items-center gap-1 text-sm', statusInfo.color)}>
          <statusInfo.icon className="h-4 w-4" />
          <span className="font-medium">{statusInfo.label}</span>
        </div>
        
        {hasOfflineActions && (
          <Badge variant="outline" className="text-xs">
            {offlineActions.length} pending
          </Badge>
        )}
        
        {showSyncButton && !isFullyOnline && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleRetry}
            disabled={isRetrying}
            className="h-6 px-2 text-xs"
          >
            <RotateCcw className={cn('h-3 w-3', isRetrying && 'animate-spin')} />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={cn('border', statusInfo.borderColor, className)}>
      <CardContent className={cn('p-4', statusInfo.bgColor)}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={cn('p-2 rounded-full bg-white dark:bg-gray-800 shadow-sm')}>
              <statusInfo.icon className={cn('h-5 w-5', statusInfo.color)} />
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">{statusInfo.label}</h3>
                <Badge 
                  variant={isFullyOnline ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {statusInfo.status}
                </Badge>
              </div>
              
              <p className="text-xs text-muted-foreground">
                {statusInfo.description}
              </p>
              
              {lastOfflineTime && !isFullyOnline && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Offline since {formatOfflineTime(lastOfflineTime)}
                </p>
              )}
              
              {lastSyncTime && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Last sync {formatOfflineTime(lastSyncTime)}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {hasOfflineActions && (
              <div className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 rounded-full shadow-sm">
                <Database className="h-3 w-3 text-blue-500" />
                <span className="text-xs font-medium">{offlineActions.length}</span>
              </div>
            )}
            
            {showSyncButton && (
              <div className="flex gap-1">
                {!isFullyOnline && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="h-8 px-3"
                  >
                    <RotateCcw className={cn('h-3 w-3 mr-1', isRetrying && 'animate-spin')} />
                    Retry
                  </Button>
                )}
                
                {hasOfflineActions && isFullyOnline && (
                  <Button
                    size="sm"
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="h-8 px-3"
                  >
                    <Activity className={cn('h-3 w-3 mr-1', isSyncing && 'animate-spin')} />
                    Sync
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Status Details */}
        {variant === 'full' && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Network</span>
                  <div className="flex items-center gap-1">
                    <Wifi className={cn('h-3 w-3', isOnline ? 'text-green-500' : 'text-red-500')} />
                    <span className={isOnline ? 'text-green-600' : 'text-red-600'}>
                      {isOnline ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Server</span>
                  <div className="flex items-center gap-1">
                    <Cloud className={cn('h-3 w-3', isServerReachable ? 'text-green-500' : 'text-red-500')} />
                    <span className={isServerReachable ? 'text-green-600' : 'text-red-600'}>
                      {isServerReachable ? 'Reachable' : 'Unreachable'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Offline Actions</span>
                  <span className="font-medium">{offlineActions.length}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Mode</span>
                  <div className="flex items-center gap-1">
                    <Smartphone className="h-3 w-3 text-blue-500" />
                    <span className="text-blue-600">
                      {isFullyOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Compact floating status indicator
export function OfflineFloatingIndicator() {
  const { isOnline, isServerReachable, offlineActions } = useOffline();
  const [isVisible, setIsVisible] = useState(false);

  const isFullyOnline = isOnline && isServerReachable;
  const hasOfflineActions = offlineActions.length > 0;

  useEffect(() => {
    // Show indicator when offline or has pending actions
    setIsVisible(!isFullyOnline || hasOfflineActions);
  }, [isFullyOnline, hasOfflineActions]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 md:bottom-4 transition-all duration-300">
      <OfflineStatus 
        variant="minimal" 
        className="bg-white dark:bg-gray-900 shadow-lg border rounded-full px-3 py-2"
      />
    </div>
  );
}

// Status bar for header
export function OfflineStatusBar() {
  const { isOnline, isServerReachable } = useOffline();
  const isFullyOnline = isOnline && isServerReachable;

  if (isFullyOnline) return null;

  return (
    <div className="bg-yellow-50 dark:bg-yellow-950 border-b border-yellow-200 dark:border-yellow-800 transition-all duration-300">
      <div className="container mx-auto px-4 py-2">
        <OfflineStatus variant="minimal" showSyncButton={false} />
      </div>
    </div>
  );
}
