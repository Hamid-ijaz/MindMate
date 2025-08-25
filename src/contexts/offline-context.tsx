'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { WifiOff, Wifi, Cloud, CloudOff } from 'lucide-react';

interface OfflineContextType {
  isOnline: boolean;
  isServerReachable: boolean;
  lastOfflineTime: number | null;
  offlineActions: any[];
  addOfflineAction: (action: any) => void;
  removeOfflineAction: (actionId: string) => void;
  retryConnection: () => Promise<void>;
  syncOfflineData: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

interface OfflineProviderProps {
  children: ReactNode;
}

export const OfflineProvider = ({ children }: OfflineProviderProps) => {
  const [isOnline, setIsOnline] = useState(true);
  const [isServerReachable, setIsServerReachable] = useState(true);
  const [lastOfflineTime, setLastOfflineTime] = useState<number | null>(null);
  const [offlineActions, setOfflineActions] = useState<any[]>([]);
  const [hasShownOfflineToast, setHasShownOfflineToast] = useState(false);
  const { toast, dismiss } = useToast();

  // Check network connectivity
  const checkNetworkStatus = useCallback(() => {
    const online = navigator.onLine;
    setIsOnline(online);
    
    if (!online && !lastOfflineTime) {
      setLastOfflineTime(Date.now());
    } else if (online && lastOfflineTime) {
      setLastOfflineTime(null);
    }
    
    return online;
  }, [lastOfflineTime]);

  // Check server reachability
  const checkServerReachability = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      const reachable = response.ok;
      setIsServerReachable(reachable);
      return reachable;
    } catch (error) {
      setIsServerReachable(false);
      return false;
    }
  }, []);

  // Show offline notification
  const showOfflineNotification = useCallback(() => {
    if (hasShownOfflineToast) return;
    
    setHasShownOfflineToast(true);
    const { dismiss: dismissToast } = toast({
      title: "You're offline",
      description: "Don't worry! Your data will sync when you're back online.",
      duration: Infinity,
      variant: "destructive",
      action: (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const online = await retryConnection();
              if (online) dismissToast();
            }}
          >
            <WifiOff className="h-4 w-4 mr-1" />
            Retry
          </Button>
        </div>
      ),
    });
  }, [hasShownOfflineToast, toast]);

  // Show online notification
  const showOnlineNotification = useCallback(() => {
    if (!hasShownOfflineToast) return;
    
    setHasShownOfflineToast(false);
    toast({
      title: "Back online!",
      description: "Your connection has been restored. Syncing data...",
      duration: 3000,
      variant: "default",
      action: (
        <div className="flex items-center">
          <Wifi className="h-4 w-4 text-green-500" />
        </div>
      ),
    });
    
    // Auto-sync when back online
    setTimeout(() => {
      syncOfflineData();
    }, 1000);
  }, [hasShownOfflineToast, toast]);

  // Add offline action
  const addOfflineAction = useCallback((action: any) => {
    const actionWithId = {
      ...action,
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    
    setOfflineActions(prev => [...prev, actionWithId]);
    
    // Store in localStorage for persistence
    try {
      const stored = localStorage.getItem('mindmate_offline_actions') || '[]';
      const actions = JSON.parse(stored);
      actions.push(actionWithId);
      localStorage.setItem('mindmate_offline_actions', JSON.stringify(actions));
    } catch (error) {
      console.error('Failed to store offline action:', error);
    }
    
    return actionWithId.id;
  }, []);

  // Remove offline action
  const removeOfflineAction = useCallback((actionId: string) => {
    setOfflineActions(prev => prev.filter(action => action.id !== actionId));
    
    // Remove from localStorage
    try {
      const stored = localStorage.getItem('mindmate_offline_actions') || '[]';
      const actions = JSON.parse(stored);
      const filteredActions = actions.filter((action: any) => action.id !== actionId);
      localStorage.setItem('mindmate_offline_actions', JSON.stringify(filteredActions));
    } catch (error) {
      console.error('Failed to remove offline action:', error);
    }
  }, []);

  // Retry connection
  const retryConnection = useCallback(async (): Promise<boolean> => {
    const networkOnline = checkNetworkStatus();
    if (!networkOnline) return false;
    
    const serverReachable = await checkServerReachability();
    
    if (networkOnline && serverReachable && lastOfflineTime) {
      showOnlineNotification();
      return true;
    }
    
    return false;
  }, [checkNetworkStatus, checkServerReachability, lastOfflineTime, showOnlineNotification]);

  // Sync offline data
  const syncOfflineData = useCallback(async (): Promise<void> => {
    if (!isOnline || !isServerReachable || offlineActions.length === 0) return;
    
    console.log('🔄 Syncing offline data...', offlineActions.length, 'actions');
    
    let syncedCount = 0;
    let failedCount = 0;
    
    for (const action of offlineActions) {
      try {
        switch (action.type) {
          case 'CREATE_TASK':
            await fetch('/api/tasks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(action.data),
            });
            break;
            
          case 'UPDATE_TASK':
            await fetch(`/api/tasks/${action.data.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(action.data),
            });
            break;
            
          case 'DELETE_TASK':
            await fetch(`/api/tasks/${action.data.id}`, {
              method: 'DELETE',
            });
            break;
            
          case 'CREATE_NOTE':
            await fetch('/api/notes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(action.data),
            });
            break;
            
          case 'UPDATE_NOTE':
            await fetch(`/api/notes/${action.data.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(action.data),
            });
            break;
            
          case 'DELETE_NOTE':
            await fetch(`/api/notes/${action.data.id}`, {
              method: 'DELETE',
            });
            break;
            
          default:
            console.warn('Unknown offline action type:', action.type);
        }
        
        removeOfflineAction(action.id);
        syncedCount++;
      } catch (error) {
        console.error('Failed to sync action:', action, error);
        failedCount++;
      }
    }
    
    if (syncedCount > 0) {
      toast({
        title: "Data synced!",
        description: `Successfully synced ${syncedCount} offline ${syncedCount === 1 ? 'action' : 'actions'}.`,
        duration: 3000,
      });
    }
    
    if (failedCount > 0) {
      toast({
        title: "Sync partially failed",
        description: `${failedCount} ${failedCount === 1 ? 'action' : 'actions'} failed to sync. Will retry later.`,
        duration: 5000,
        variant: "destructive",
      });
    }
  }, [isOnline, isServerReachable, offlineActions, removeOfflineAction, toast]);

  // Load offline actions from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('mindmate_offline_actions');
      if (stored) {
        const actions = JSON.parse(stored);
        setOfflineActions(actions);
      }
    } catch (error) {
      console.error('Failed to load offline actions:', error);
    }
  }, []);

  // Monitor network status
  useEffect(() => {
    checkNetworkStatus();
    
    const handleOnline = () => {
      console.log('🌐 Network status: Online');
      setIsOnline(true);
      checkServerReachability().then(reachable => {
        if (reachable && lastOfflineTime) {
          showOnlineNotification();
        }
      });
    };
    
    const handleOffline = () => {
      console.log('🚫 Network status: Offline');
      setIsOnline(false);
      setIsServerReachable(false);
      if (!lastOfflineTime) {
        setLastOfflineTime(Date.now());
      }
      showOfflineNotification();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkNetworkStatus, checkServerReachability, lastOfflineTime, showOfflineNotification, showOnlineNotification]);

  // Periodic server reachability check
  useEffect(() => {
    if (!isOnline) return;
    
    const interval = setInterval(async () => {
      const wasReachable = isServerReachable;
      const nowReachable = await checkServerReachability();
      
      // If server becomes unreachable while network is online
      if (!nowReachable && wasReachable) {
        toast({
          title: "Server unreachable",
          description: "Can't connect to MindMate servers. Working offline...",
          duration: 5000,
          variant: "destructive",
          action: (
            <div className="flex items-center">
              <CloudOff className="h-4 w-4" />
            </div>
          ),
        });
      }
      
      // If server becomes reachable again
      if (nowReachable && !wasReachable) {
        toast({
          title: "Server connected",
          description: "Connection to MindMate servers restored!",
          duration: 3000,
          action: (
            <div className="flex items-center">
              <Cloud className="h-4 w-4 text-green-500" />
            </div>
          ),
        });
        
        // Auto-sync when server becomes reachable
        setTimeout(() => {
          syncOfflineData();
        }, 1000);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [isOnline, isServerReachable, checkServerReachability, toast, syncOfflineData]);

  const contextValue: OfflineContextType = {
    isOnline,
    isServerReachable,
    lastOfflineTime,
    offlineActions,
    addOfflineAction,
    removeOfflineAction,
    retryConnection,
    syncOfflineData,
  };

  return (
    <OfflineContext.Provider value={contextValue}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = (): OfflineContextType => {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};

// Helper hook for checking online status
export const useOnlineStatus = () => {
  const { isOnline, isServerReachable } = useOffline();
  return isOnline && isServerReachable;
};

// Helper hook for offline-first operations
export const useOfflineCapable = () => {
  const { isOnline, isServerReachable, addOfflineAction } = useOffline();
  
  const executeOfflineCapable = useCallback(async (
    operation: () => Promise<any>,
    fallbackAction?: any
  ) => {
    if (isOnline && isServerReachable) {
      try {
        return await operation();
      } catch (error) {
        // If operation fails online, queue for offline sync
        if (fallbackAction) {
          addOfflineAction(fallbackAction);
        }
        throw error;
      }
    } else {
      // Store action for later sync
      if (fallbackAction) {
        addOfflineAction(fallbackAction);
        return { offline: true, queued: true };
      }
      throw new Error('Operation not available offline');
    }
  }, [isOnline, isServerReachable, addOfflineAction]);
  
  return executeOfflineCapable;
};
