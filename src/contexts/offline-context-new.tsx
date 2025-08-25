'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
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
  console.log('🔧 OfflineProvider initializing...');
  
  const [isOnline, setIsOnline] = useState(true);
  const [isServerReachable, setIsServerReachable] = useState(true);
  const [lastOfflineTime, setLastOfflineTime] = useState<number | null>(null);
  const [offlineActions, setOfflineActions] = useState<any[]>([]);
  const [hasShownOfflineToast, setHasShownOfflineToast] = useState(false);
  
  const { toast, dismiss } = useToast();
  const { user } = useAuth();
  
  // Use refs to store toast IDs to avoid dependency issues
  const currentOfflineToastId = useRef<string | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        signal: AbortSignal.timeout(5000)
      });
      const reachable = response.ok;
      setIsServerReachable(reachable);
      return reachable;
    } catch (error) {
      setIsServerReachable(false);
      return false;
    }
  }, []);

  // Show offline notification (only one at a time)
  const showOfflineNotification = useCallback(() => {
    if (hasShownOfflineToast || currentOfflineToastId.current) return;
    
    setHasShownOfflineToast(true);
    
    const toastResult = toast({
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
              if (online && currentOfflineToastId.current) {
                dismiss(currentOfflineToastId.current);
                currentOfflineToastId.current = null;
                setHasShownOfflineToast(false);
              }
            }}
          >
            <WifiOff className="h-4 w-4 mr-1" />
            Retry
          </Button>
        </div>
      ),
    });
    
    // Store the toast ID for later dismissal
    if (toastResult && typeof toastResult === 'object' && 'id' in toastResult) {
      currentOfflineToastId.current = toastResult.id as string;
    }
  }, [hasShownOfflineToast, toast, dismiss]);

  // Show online notification
  const showOnlineNotification = useCallback(() => {
    if (!hasShownOfflineToast) return;
    
    // Dismiss the offline toast first
    if (currentOfflineToastId.current) {
      dismiss(currentOfflineToastId.current);
      currentOfflineToastId.current = null;
    }
    
    setHasShownOfflineToast(false);
    setLastOfflineTime(null);
    
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
    
    // Trigger sync after a delay
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    syncTimeoutRef.current = setTimeout(() => {
      syncOfflineData();
    }, 1000);
  }, [hasShownOfflineToast, toast, dismiss]);

  // Add offline action
  const addOfflineAction = useCallback((action: any) => {
    const actionWithId = {
      ...action,
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    
    console.log('➕ Adding offline action:', actionWithId.type, actionWithId);
    
    setOfflineActions(prev => [...prev, actionWithId]);
    
    // Store in localStorage for persistence
    try {
      const stored = localStorage.getItem('mindmate_offline_actions') || '[]';
      const actions = JSON.parse(stored);
      actions.push(actionWithId);
      localStorage.setItem('mindmate_offline_actions', JSON.stringify(actions));
      console.log('💾 Offline action stored in localStorage. Total actions:', actions.length);
    } catch (error) {
      console.error('❌ Failed to store offline action:', error);
    }
    
    return actionWithId.id;
  }, []);

  // Remove offline action
  const removeOfflineAction = useCallback((actionId: string) => {
    console.log('🗑️ Removing offline action:', actionId);
    setOfflineActions(prev => prev.filter(action => action.id !== actionId));
    
    // Remove from localStorage
    try {
      const stored = localStorage.getItem('mindmate_offline_actions') || '[]';
      const actions = JSON.parse(stored);
      const filteredActions = actions.filter((action: any) => action.id !== actionId);
      localStorage.setItem('mindmate_offline_actions', JSON.stringify(filteredActions));
      console.log('💾 Offline action removed from localStorage. Remaining actions:', filteredActions.length);
    } catch (error) {
      console.error('❌ Failed to remove offline action:', error);
    }
  }, []);

  // Retry connection
  const retryConnection = useCallback(async (): Promise<boolean> => {
    const networkOnline = checkNetworkStatus();
    if (!networkOnline) return false;
    
    const serverReachable = await checkServerReachability();
    
    if (networkOnline && serverReachable && hasShownOfflineToast) {
      showOnlineNotification();
      return true;
    }
    
    return false;
  }, [checkNetworkStatus, checkServerReachability, hasShownOfflineToast, showOnlineNotification]);

  // Sync offline data
  const syncOfflineData = useCallback(async (): Promise<void> => {
    console.log('🔄 syncOfflineData called - isOnline:', isOnline, 'isServerReachable:', isServerReachable, 'offlineActions:', offlineActions.length);
    
    if (!isOnline || !isServerReachable) {
      console.log('❌ Sync cancelled: Not online or server not reachable');
      return;
    }
    
    if (!user?.email) {
      console.log('❌ Sync cancelled: No authenticated user or email');
      return;
    }

    // Get current actions to sync (check localStorage for latest)
    let actionsToSync = offlineActions;
    try {
      const stored = localStorage.getItem('mindmate_offline_actions');
      if (stored) {
        const localStorageActions = JSON.parse(stored);
        if (localStorageActions.length > offlineActions.length) {
          console.log('📋 Using localStorage actions as they have more items');
          actionsToSync = localStorageActions;
          setOfflineActions(localStorageActions);
        }
      }
    } catch (error) {
      console.error('❌ Error checking localStorage during sync:', error);
    }
    
    if (actionsToSync.length === 0) {
      console.log('ℹ️ Sync cancelled: No offline actions to sync');
      return;
    }
    
    console.log('🔄 Starting sync process...', actionsToSync.length, 'actions');
    
    // Import services dynamically
    const { taskService, noteService } = await import('@/lib/firestore');
    
    let syncedCount = 0;
    let failedCount = 0;
    
    for (const action of actionsToSync) {
      try {
        console.log('🔄 Syncing action:', action.type, action.data?.id);
        
        switch (action.type) {
          case 'CREATE_TASK':
            const { id: taskId, syncStatus, isLocal, userEmail: actionUserEmail, ...taskData } = action.data;
            const currentUserEmail = user.email;
            console.log('🔍 Syncing task with userEmail:', currentUserEmail);
            const newTaskId = await taskService.addTask(currentUserEmail, taskData);
            console.log('✅ Task synced with new ID:', newTaskId);
            break;
            
          case 'UPDATE_TASK':
            const { id: updateTaskId, syncStatus: updateSyncStatus, isLocal: updateIsLocal, userEmail: updateUserEmail, ...updateTaskData } = action.data;
            await taskService.updateTask(updateTaskId, updateTaskData);
            console.log('✅ Task updated:', updateTaskId);
            break;
            
          case 'DELETE_TASK':
            await taskService.deleteTask(action.data.id);
            console.log('✅ Task deleted:', action.data.id);
            break;
            
          case 'CREATE_NOTE':
            const { id: noteId, syncStatus: noteSyncStatus, isLocal: noteIsLocal, createdAt: noteCreatedAt, updatedAt: noteUpdatedAt, userEmail: noteActionUserEmail, ...noteData } = action.data;
            const currentNoteUserEmail = user.email;
            console.log('🔍 Syncing note with userEmail:', currentNoteUserEmail);
            
            // Ensure the note has the correct userId field
            const noteDataWithUserId = {
              ...noteData,
              userId: currentNoteUserEmail
            };
            
            const newNoteId = await noteService.addNote(noteDataWithUserId);
            console.log('✅ Note synced with new ID:', newNoteId);
            break;
            
          case 'UPDATE_NOTE':
            const { id: updateNoteId, syncStatus: updateNoteSyncStatus, isLocal: updateNoteIsLocal, userEmail: updateNoteUserEmail, ...updateNoteData } = action.data;
            await noteService.updateNote(updateNoteId, updateNoteData);
            console.log('✅ Note updated:', updateNoteId);
            break;
            
          case 'DELETE_NOTE':
            await noteService.deleteNote(action.data.id);
            console.log('✅ Note deleted:', action.data.id);
            break;
            
          default:
            console.warn('❓ Unknown offline action type:', action.type);
        }
        
        removeOfflineAction(action.id);
        syncedCount++;
        console.log('✅ Action synced successfully');
      } catch (error) {
        console.error('❌ Failed to sync action:', action, error);
        failedCount++;
      }
    }
    
    console.log('🏁 Sync completed - Success:', syncedCount, 'Failed:', failedCount);
    
    // Show sync results
    if (syncedCount > 0) {
      toast({
        title: "Data synced!",
        description: `Successfully synced ${syncedCount} offline ${syncedCount === 1 ? 'action' : 'actions'}.`,
        duration: 3000,
      });
      
      // Trigger data refresh
      window.dispatchEvent(new CustomEvent('offline-sync-completed', { 
        detail: { syncedCount, failedCount } 
      }));
    }
    
    if (failedCount > 0) {
      toast({
        title: "Sync partially failed",
        description: `${failedCount} ${failedCount === 1 ? 'action' : 'actions'} failed to sync. Will retry later.`,
        duration: 5000,
        variant: "destructive",
      });
    }
  }, [isOnline, isServerReachable, user?.email, offlineActions, removeOfflineAction, toast]);

  // Load offline actions from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('mindmate_offline_actions');
      if (stored) {
        const actions = JSON.parse(stored);
        console.log('📝 Loaded offline actions:', actions.length, 'actions');
        setOfflineActions(actions);
      }
    } catch (error) {
      console.error('❌ Failed to load offline actions:', error);
    }
  }, []);

  // Monitor network status
  useEffect(() => {
    checkNetworkStatus();
    
    const handleOnline = () => {
      console.log('🌐 Network status: Online');
      const wasOffline = !isOnline;
      setIsOnline(true);
      
      checkServerReachability().then(reachable => {
        if (reachable && wasOffline && hasShownOfflineToast) {
          showOnlineNotification();
        }
      });
    };
    
    const handleOffline = () => {
      console.log('🚫 Network status: Offline');
      const wasOnline = isOnline;
      setIsOnline(false);
      setIsServerReachable(false);
      
      if (!lastOfflineTime) {
        setLastOfflineTime(Date.now());
      }
      
      if (wasOnline && !hasShownOfflineToast) {
        showOfflineNotification();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOnline, hasShownOfflineToast, lastOfflineTime, checkNetworkStatus, checkServerReachability, showOnlineNotification, showOfflineNotification]);

  // Auto-sync when conditions are met
  useEffect(() => {
    if (offlineActions.length > 0 && isOnline && isServerReachable && user?.email) {
      console.log('🔄 Auto-triggering sync for offline actions...');
      
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      
      syncTimeoutRef.current = setTimeout(() => {
        syncOfflineData();
      }, 2000);
      
      return () => {
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }
      };
    }
  }, [offlineActions.length, isOnline, isServerReachable, user?.email, syncOfflineData]);

  // Periodic server reachability check
  useEffect(() => {
    if (!isOnline) return;
    
    const interval = setInterval(async () => {
      const wasReachable = isServerReachable;
      const nowReachable = await checkServerReachability();
      
      // Only show server status toasts if we're not already showing offline toast
      if (!nowReachable && wasReachable && !hasShownOfflineToast) {
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
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }
        syncTimeoutRef.current = setTimeout(() => {
          syncOfflineData();
        }, 1000);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [isOnline, isServerReachable, hasShownOfflineToast, checkServerReachability, toast, syncOfflineData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentOfflineToastId.current) {
        dismiss(currentOfflineToastId.current);
      }
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [dismiss]);

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
        if (fallbackAction) {
          addOfflineAction(fallbackAction);
        }
        throw error;
      }
    } else {
      if (fallbackAction) {
        addOfflineAction(fallbackAction);
        return { offline: true, queued: true };
      }
      throw new Error('Operation not available offline');
    }
  }, [isOnline, isServerReachable, addOfflineAction]);
  
  return executeOfflineCapable;
};
