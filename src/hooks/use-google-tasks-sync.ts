import { useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';

interface UseGoogleTasksSyncOptions {
  autoSync?: boolean;
  onSyncComplete?: (result: { success: boolean; synced: number; errors: string[] }) => void;
  onSyncError?: (error: string) => void;
}

/**
 * Hook for Google Tasks synchronization - Client-side only, uses API endpoints
 */
export function useGoogleTasksSync({
  autoSync = false,
  onSyncComplete,
  onSyncError
}: UseGoogleTasksSyncOptions = {}) {
  const { user } = useAuth();

  /**
   * Trigger a full sync manually via API endpoint
   */
  const triggerSync = useCallback(async () => {
    if (!user?.email) {
      onSyncError?.('User not authenticated');
      return { success: false, synced: 0, errors: ['User not authenticated'], conflicts: [] };
    }

    try {
      const response = await fetch('/api/google/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      onSyncComplete?.(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
      onSyncError?.(errorMessage);
      return { success: false, synced: 0, errors: [errorMessage], conflicts: [] };
    }
  }, [user?.email, onSyncComplete, onSyncError]);

  /**
   * Sync a single task change (for real-time sync) via API endpoint
   */
  const syncTaskChange = useCallback(async (taskId: string) => {
    if (!user?.email) return;

    try {
      const response = await fetch('/api/google/sync', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ taskId, action: 'syncTask' })
      });

      if (!response.ok) {
        console.error(`Failed to sync task ${taskId}: ${response.status}`);
      }
    } catch (error) {
      console.error('Error syncing task change:', error);
      onSyncError?.(error instanceof Error ? error.message : 'Failed to sync task');
    }
  }, [user?.email, onSyncError]);

  /**
   * Sync task deletion via API endpoint
   */
  const syncTaskDeletion = useCallback(async (taskId: string, googleTaskId?: string) => {
    if (!user?.email) return;

    try {
      const response = await fetch('/api/google/sync', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ taskId, googleTaskId, action: 'deleteTask' })
      });

      if (!response.ok) {
        console.error(`Failed to sync task deletion ${taskId}: ${response.status}`);
      }
    } catch (error) {
      console.error('Error syncing task deletion:', error);
      onSyncError?.(error instanceof Error ? error.message : 'Failed to sync task deletion');
    }
  }, [user?.email, onSyncError]);

  /**
   * Sync all incomplete tasks to Google Tasks via API endpoint
   */
  const syncAllIncompleteTasks = useCallback(async () => {
    if (!user?.email) {
      onSyncError?.('User not authenticated');
      return { success: false, syncedCount: 0, skippedCount: 0, errors: ['User not authenticated'] };
    }

    try {
      const response = await fetch('/api/google/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ action: 'syncAllIncomplete' })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      onSyncComplete?.(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown bulk sync error';
      onSyncError?.(errorMessage);
      return { success: false, syncedCount: 0, skippedCount: 0, errors: [errorMessage] };
    }
  }, [user?.email, onSyncComplete, onSyncError]);

  // Auto-sync on mount if enabled
  useEffect(() => {
    if (autoSync && user?.email) {
      triggerSync();
    }
  }, [autoSync, user?.email, triggerSync]);

  return {
    triggerSync,
    syncTaskChange,
    syncTaskDeletion,
    syncAllIncompleteTasks
  };
}

/**
 * Hook for getting Google Tasks connection status
 */
export function useGoogleTasksStatus() {
  const { user } = useAuth();

  const getStatus = useCallback(async () => {
    if (!user?.email) return null;

    try {
      const response = await fetch('/api/google/sync');
      if (!response.ok) return null;
      
      return await response.json();
    } catch (error) {
      console.error('Error getting Google Tasks status:', error);
      return null;
    }
  }, [user?.email]);

  return { getStatus };
}
