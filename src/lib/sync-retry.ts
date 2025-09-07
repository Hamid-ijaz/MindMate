/**
 * Sync Retry Utility
 * Handles retrying failed Google Tasks sync operations with exponential backoff
 */

export interface SyncRetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  operation: string;
  taskId?: string;
}

export class SyncRetryManager {
  private static instance: SyncRetryManager;
  private retryQueue: Map<string, SyncRetryOptions & { retryCount: number; nextRetry: number }> = new Map();
  private isProcessing = false;

  static getInstance(): SyncRetryManager {
    if (!SyncRetryManager.instance) {
      SyncRetryManager.instance = new SyncRetryManager();
    }
    return SyncRetryManager.instance;
  }

  /**
   * Add a failed sync operation to the retry queue
   */
  addToRetryQueue(options: SyncRetryOptions): void {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 30000,
      operation,
      taskId
    } = options;

    const key = taskId ? `${operation}-${taskId}` : operation;
    const existingEntry = this.retryQueue.get(key);

    if (existingEntry && existingEntry.retryCount >= maxRetries) {
      console.warn(`Max retries reached for ${operation}${taskId ? ` (task: ${taskId})` : ''}`);
      return;
    }

    const retryCount = existingEntry ? existingEntry.retryCount + 1 : 1;
    const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), maxDelay);
    const nextRetry = Date.now() + delay;

    this.retryQueue.set(key, {
      ...options,
      maxRetries,
      baseDelay,
      maxDelay,
      retryCount,
      nextRetry
    });

    console.log(`Added ${operation} to retry queue (attempt ${retryCount}/${maxRetries}) - next retry in ${delay}ms`);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processRetryQueue();
    }
  }

  /**
   * Remove a successful operation from retry queue
   */
  removeFromRetryQueue(operation: string, taskId?: string): void {
    const key = taskId ? `${operation}-${taskId}` : operation;
    if (this.retryQueue.delete(key)) {
      console.log(`Removed ${operation}${taskId ? ` (task: ${taskId})` : ''} from retry queue - operation succeeded`);
    }
  }

  /**
   * Process the retry queue
   */
  private async processRetryQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.retryQueue.size > 0) {
      const now = Date.now();
      const readyEntries = Array.from(this.retryQueue.entries())
        .filter(([, entry]) => entry.nextRetry <= now)
        .sort(([, a], [, b]) => a.nextRetry - b.nextRetry);

      if (readyEntries.length === 0) {
        // Wait for the next entry to be ready
        const nextEntry = Array.from(this.retryQueue.values())
          .reduce((earliest, entry) => 
            !earliest || entry.nextRetry < earliest.nextRetry ? entry : earliest
          );
        
        if (nextEntry) {
          const waitTime = Math.max(nextEntry.nextRetry - now, 1000);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        } else {
          break;
        }
      }

      // Process ready entries
      for (const [key, entry] of readyEntries) {
        try {
          console.log(`Retrying ${entry.operation}${entry.taskId ? ` (task: ${entry.taskId})` : ''} - attempt ${entry.retryCount}/${entry.maxRetries}`);
          
          await this.executeRetry(entry);
          
          // Success - remove from queue
          this.retryQueue.delete(key);
          console.log(`Retry successful for ${entry.operation}${entry.taskId ? ` (task: ${entry.taskId})` : ''}`);
        } catch (error) {
          console.error(`Retry failed for ${entry.operation}${entry.taskId ? ` (task: ${entry.taskId})` : ''}:`, error);
          
          if (entry.retryCount >= entry.maxRetries!) {
            // Max retries reached
            this.retryQueue.delete(key);
            console.error(`Max retries reached for ${entry.operation}${entry.taskId ? ` (task: ${entry.taskId})` : ''} - giving up`);
          } else {
            // Schedule next retry
            const delay = Math.min(
              entry.baseDelay! * Math.pow(2, entry.retryCount),
              entry.maxDelay!
            );
            entry.retryCount++;
            entry.nextRetry = Date.now() + delay;
            this.retryQueue.set(key, entry);
            console.log(`Scheduled next retry for ${entry.operation} in ${delay}ms`);
          }
        }
      }

      // Small delay between batch processing
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isProcessing = false;
  }

  /**
   * Execute a retry operation
   */
  private async executeRetry(entry: SyncRetryOptions & { retryCount: number }): Promise<void> {
    const { operation, taskId } = entry;

    switch (operation) {
      case 'syncTask':
        if (!taskId) throw new Error('taskId required for syncTask operation');
        await this.retrySyncTask(taskId);
        break;
      
      case 'deleteTask':
        if (!taskId) throw new Error('taskId required for deleteTask operation');
        await this.retryDeleteTask(taskId);
        break;
      
      case 'bulkSync':
        await this.retryBulkSync();
        break;
      
      default:
        throw new Error(`Unknown retry operation: ${operation}`);
    }
  }

  /**
   * Retry syncing a single task
   */
  private async retrySyncTask(taskId: string): Promise<void> {
    const response = await fetch('/api/google/sync', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ taskId, action: 'syncTask' })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Sync task failed: ${error}`);
    }
  }

  /**
   * Retry deleting a task
   */
  private async retryDeleteTask(taskId: string): Promise<void> {
    const response = await fetch('/api/google/sync', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ taskId, action: 'deleteTask' })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Delete task failed: ${error}`);
    }
  }

  /**
   * Retry bulk sync
   */
  private async retryBulkSync(): Promise<void> {
    const response = await fetch('/api/google/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Bulk sync failed: ${error}`);
    }
  }

  /**
   * Get current retry queue status
   */
  getQueueStatus(): Array<{
    operation: string;
    taskId?: string;
    retryCount: number;
    maxRetries: number;
    nextRetry: number;
  }> {
    return Array.from(this.retryQueue.values()).map(entry => ({
      operation: entry.operation,
      taskId: entry.taskId,
      retryCount: entry.retryCount,
      maxRetries: entry.maxRetries!,
      nextRetry: entry.nextRetry
    }));
  }

  /**
   * Clear all retry operations (useful for testing or reset)
   */
  clearQueue(): void {
    this.retryQueue.clear();
    console.log('Retry queue cleared');
  }
}

// Export singleton instance
export const syncRetryManager = SyncRetryManager.getInstance();
