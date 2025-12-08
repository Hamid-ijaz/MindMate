import type { Task, GoogleTasksSettings } from '@/lib/types';
import { googleTasksIntegration } from './google-tasks';
import { googleTasksService, taskService } from '@/lib/firestore';
import { categoryTaskListManager } from './category-task-list-manager';
import { tasks_v1 } from 'googleapis';

interface SyncConflict {
  appTask: Task;
  googleTask: tasks_v1.Schema$Task;
  conflictType: 'both_modified' | 'deleted_in_app' | 'deleted_in_google';
}

interface TaskCacheEntry {
  task: Task;
  syncData?: any;
}

interface GoogleTaskCacheEntry {
  task: tasks_v1.Schema$Task;
  taskListId: string;
}

interface SyncContext {
  userEmail: string;
  settings: GoogleTasksSettings;
  localTasksCache: Map<string, TaskCacheEntry>;
  googleTasksCache: Map<string, GoogleTaskCacheEntry>;
  tasksByGoogleId: Map<string, Task>;
  firebaseWriteQueue: Array<() => Promise<void>>;
  parentChildMap: Map<string, string[]>; // parentId -> childIds
  googleParentChildMap: Map<string, string[]>; // googleParentId -> googleChildIds
}

class GoogleTasksSyncService {
  // Only sync tasks completed within the last 30 days
  private readonly RECENT_COMPLETION_THRESHOLD = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

  /**
   * User-friendly console log with consistent formatting
   */
  private log(level: 'info' | 'warn' | 'error' | 'success', message: string, data?: any) {
    const emoji = {
      info: '📋',
      warn: '⚠️',
      error: '❌',
      success: '✅'
    };
    
    const timestamp = new Date().toLocaleTimeString();
    const formattedMessage = `${emoji[level]} [${timestamp}] ${message}`;
    
    if (level === 'error') {
      console.error(formattedMessage, data ? data : '');
    } else if (level === 'warn') {
      console.warn(formattedMessage, data ? data : '');
    } else {
      console.log(formattedMessage, data ? data : '');
    }
  }

  /**
   * Build parent-child relationship maps for efficient lookup
   */
  private buildParentChildMaps(tasks: Task[]): Map<string, string[]> {
    const parentChildMap = new Map<string, string[]>();
    
    for (const task of tasks) {
      if (task.parentId) {
        if (!parentChildMap.has(task.parentId)) {
          parentChildMap.set(task.parentId, []);
        }
        parentChildMap.get(task.parentId)!.push(task.id);
      }
    }
    
    return parentChildMap;
  }

  /**
   * Build Google Tasks parent-child relationship maps
   */
  private buildGoogleParentChildMaps(googleTasks: tasks_v1.Schema$Task[]): Map<string, string[]> {
    const googleParentChildMap = new Map<string, string[]>();
    
    for (const task of googleTasks) {
      if (task.parent && task.id) {
        if (!googleParentChildMap.has(task.parent)) {
          googleParentChildMap.set(task.parent, []);
        }
        googleParentChildMap.get(task.parent)!.push(task.id);
      }
    }
    
    return googleParentChildMap;
  }

  /**
   * Execute Firebase write operations in batches to reduce database hits
   */
  private async executeBatchOperations(operations: Array<() => Promise<void>>): Promise<void> {
    if (operations.length === 0) return;
    
    console.log(`Executing ${operations.length} Firebase operations in batches`);
    
    const batchSize = 10; // Process 10 operations at a time
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      await Promise.all(batch.map(op => op()));
      
      // Small delay between batches to avoid overwhelming Firebase
      if (i + batchSize < operations.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`Completed ${operations.length} Firebase operations`);
  }

  /**
   * Verify that Google Task exists and is accessible
   */
  private async verifyGoogleTaskExists(userEmail: string, googleTaskId: string, taskListId: string): Promise<boolean> {
    try {
      const googleTasks = await googleTasksIntegration.getTasks(userEmail, taskListId);
      return googleTasks.some(task => task.id === googleTaskId && !task.deleted);
    } catch (error) {
      this.log('warn', `Failed to verify Google task existence: ${googleTaskId}`, error);
      return false;
    }
  }

  /**
   * Check if a task was recently completed (within the threshold)
   */
  private isRecentlyCompleted(task: Task): boolean {
    if (!task.completedAt) return false;
    const now = Date.now();
    return (now - task.completedAt) <= this.RECENT_COMPLETION_THRESHOLD;
  }

  /**
   * Check if a completed task should be synced to archived list
   */
  private shouldSyncCompletedTask(task: Task): boolean {
    if (!task.completedAt) return true; // Not completed, should sync normally
    return this.isRecentlyCompleted(task); // Only sync if recently completed
  }

  /**
   * Determine which Google task list to use for a given task
   * Ensures parent-child relationships are preserved by keeping families in the same list
   */
  private async getTaskListForTask(userEmail: string, task: Task, settings: GoogleTasksSettings): Promise<string> {
    const syncMode = settings.syncMode || 'single-list';
    
    if (syncMode === 'single-list') {
      // Use the default task list for single-list mode
      return settings.defaultTaskListId || '@default';
    }
    
    // Category-based mode with parent-child relationship preservation
    
    // If this task has a parent, use the same task list as the parent
    if (task.parentId) {
      const parentTask = await taskService.getTask(task.parentId);
      if (parentTask) {
        // Get the task list ID where the parent is synced
        const parentSyncData = await googleTasksService.getTaskGoogleSyncData(userEmail, parentTask.id);
        if (parentSyncData?.taskListId) {
          // Verify the task list still exists before using it
          try {
            await googleTasksIntegration.getTasks(userEmail, parentSyncData.taskListId);
            this.log('info', `Child task using parent's task list`, {
              childTaskId: task.id,
              parentTaskId: parentTask.id,
              taskListId: parentSyncData.taskListId
            });
            return parentSyncData.taskListId;
          } catch (error) {
            // Task list no longer exists, clean up the reference
            this.log('warn', `Parent's task list no longer exists, cleaning up reference`, {
              childTaskId: task.id,
              parentTaskId: parentTask.id,
              invalidTaskListId: parentSyncData.taskListId,
              error: error instanceof Error ? error.message : String(error)
            });
            
            // Clear the invalid Google task data for the parent
            await googleTasksService.syncTaskToGoogleTasks(userEmail, parentTask.id, {
              googleTaskId: undefined,
              syncStatus: 'pending',
              lastSync: Date.now(),
              googleTaskUrl: undefined
            });
          }
        }
        
        // If parent doesn't have a valid task list, determine it recursively
        const parentTaskListId = await this.getTaskListForTask(userEmail, parentTask, settings);
        this.log('info', `Child task using parent's determined task list`, {
          childTaskId: task.id,
          parentTaskId: parentTask.id,
          taskListId: parentTaskListId
        });
        return parentTaskListId;
      }
    }
    
    // If this task has children, check if any already have a task list assigned
    const allTasks = await taskService.getTasks(userEmail);
    const childTasks = allTasks.filter(t => t.parentId === task.id);
    
    if (childTasks.length > 0) {
      for (const childTask of childTasks) {
        const childSyncData = await googleTasksService.getTaskGoogleSyncData(userEmail, childTask.id);
        if (childSyncData?.taskListId) {
          // Verify the task list still exists before using it
          try {
            await googleTasksIntegration.getTasks(userEmail, childSyncData.taskListId);
            this.log('info', `Parent task using existing child's task list`, {
              parentTaskId: task.id,
              childTaskId: childTask.id,
              taskListId: childSyncData.taskListId
            });
            return childSyncData.taskListId;
          } catch (error) {
            // Task list no longer exists, clean up the reference
            this.log('warn', `Child's task list no longer exists, cleaning up reference`, {
              parentTaskId: task.id,
              childTaskId: childTask.id,
              invalidTaskListId: childSyncData.taskListId,
              error: error instanceof Error ? error.message : String(error)
            });
            
            // Clear the invalid Google task data for the child
            await googleTasksService.syncTaskToGoogleTasks(userEmail, childTask.id, {
              googleTaskId: undefined,
              syncStatus: 'pending',
              lastSync: Date.now(),
              googleTaskUrl: undefined
            });
          }
        }
      }
    }
    
    // No existing family relationships, determine based on task state
    if (task.isArchived === true) {
      // Tasks explicitly marked as archived should go to archived list
      console.log(`📁 Task ${task.id} marked as archived, using archived task list`);
      return await categoryTaskListManager.getOrCreateArchivedTaskList(userEmail);
    }
    
   
    // Use category-specific task list for active tasks
    const category = task.category || 'Uncategorized';
    return await categoryTaskListManager.getOrCreateCategoryTaskList(userEmail, category);
  }

  /**
   * Get all relevant task lists based on sync mode
   */
  private async getAllRelevantTaskLists(userEmail: string, settings: GoogleTasksSettings): Promise<string[]> {
    const syncMode = settings.syncMode || 'single-list';
    
    if (syncMode === 'single-list') {
      return [settings.defaultTaskListId || '@default'];
    }
    
    // Category-based mode - get all category task lists + archived list
    const categoryTaskLists = await categoryTaskListManager.getAllCategoryTaskLists(userEmail);
    const taskListIds = Object.values(categoryTaskLists);
    
    // Add archived task list if it exists
    if (settings.archivedTaskListId) {
      taskListIds.push(settings.archivedTaskListId);
    }
    
    return taskListIds;
  }

  /**
   * Perform full two-way sync for a user
   */
  /**
   * Main sync method that handles both single-list and category-based modes
   * Optimized with caching and batch operations to reduce Firebase hits
   */
  async syncUserTasks(userEmail: string): Promise<{
    success: boolean;
    synced: number;
    conflicts: SyncConflict[];
    errors: string[];
  }> {
    try {
      // Get settings with persistence verification
      const settings = await this.getVerifiedSettings(userEmail);
      if (!settings?.isConnected || !settings?.syncEnabled) {
        return { success: false, synced: 0, conflicts: [], errors: ['Google Tasks not connected or sync disabled'] };
      }

      // Update sync status
      await googleTasksService.updateGoogleTasksSettings(userEmail, {
        syncStatus: 'syncing'
      });

      // Initialize sync context for optimized operations
      const syncContext: SyncContext = {
        userEmail,
        settings,
        localTasksCache: new Map(),
        googleTasksCache: new Map(),
        tasksByGoogleId: new Map(),
        firebaseWriteQueue: [],
        parentChildMap: new Map(),
        googleParentChildMap: new Map()
      };

      // Load and cache all local tasks in one operation
      await this.loadLocalTasksToCache(syncContext);

      let stats = {
        googleTasksProcessed: 0,
        localTasksSynced: 0,
        createdLocal: 0,
        updatedLocal: 0,
        deletedLocal: 0,
        createdGoogle: 0,
        updatedGoogle: 0,
        deletedGoogle: 0
      };

      if (settings.syncMode === 'single-list') {
        stats = await this.processSingleListSyncOptimized(syncContext, stats);
      } else {
        stats = await this.processCategoryBasedSyncOptimized(syncContext, stats);
      }

      // Execute all Firebase operations in batches
      await this.executeBatchOperations(syncContext.firebaseWriteQueue);

      const totalSynced = stats.createdLocal + stats.updatedLocal + stats.createdGoogle + stats.updatedGoogle;

      // Update settings with persistence
      await googleTasksService.updateGoogleTasksSettings(userEmail, {
        syncStatus: 'success',
        lastSyncAt: Date.now(),
        lastError: undefined,
        syncMode: settings.syncMode, // Ensure settings persistence
        syncDirection: settings.syncDirection,
        taskListPrefix: settings.taskListPrefix,
        onDeletedTasksAction: settings.onDeletedTasksAction
      });

      console.log(`Google Tasks sync completed successfully! Synced ${totalSynced} items`);

      return {
        success: true,
        synced: totalSynced,
        conflicts: [], // We can implement conflict detection later if needed
        errors: []
      };
    } catch (error) {
      await googleTasksService.updateGoogleTasksSettings(userEmail, {
        syncStatus: 'error',
        lastError: error instanceof Error ? error.message : 'Unknown sync error'
      });
      
      return {
        success: false,
        synced: 0,
        conflicts: [],
        errors: [error instanceof Error ? error.message : 'Unknown sync error']
      };
    }
  }

  /**
   * Get settings with verification that they are properly persisted
   */
  private async getVerifiedSettings(userEmail: string): Promise<GoogleTasksSettings | null> {
    const settings = await googleTasksService.getGoogleTasksSettings(userEmail);
    
    if (!settings) {
      this.log('warn', 'No Google Tasks settings found for user');
      return null;
    }

    // Verify settings have required defaults and persist any missing values
    const updates: Partial<GoogleTasksSettings> = {};
    let needsUpdate = false;

    if (!settings.syncMode) {
      updates.syncMode = 'single-list';
      needsUpdate = true;
    }

    if (!settings.syncDirection) {
      updates.syncDirection = 'bidirectional';
      needsUpdate = true;
    }

    if (!settings.onDeletedTasksAction) {
      updates.onDeletedTasksAction = 'skip';
      needsUpdate = true;
    }

    if (!settings.taskListPrefix && settings.syncMode === 'category-based') {
      updates.taskListPrefix = 'MindMate_';
      needsUpdate = true;
    }

    if (needsUpdate) {
      this.log('info', 'Updating settings with missing defaults', updates);
      await googleTasksService.updateGoogleTasksSettings(userEmail, updates);
      
      // Return updated settings
      return { ...settings, ...updates };
    }

    return settings;
  }

  /**
   * Load all local tasks into cache with parent-child mapping
   */
  private async loadLocalTasksToCache(syncContext: SyncContext): Promise<void> {
    this.log('info', 'Loading local tasks into cache');
    
    const localTasks = await taskService.getTasks(syncContext.userEmail);
    
    // Build cache and parent-child relationships
    for (const task of localTasks) {
      syncContext.localTasksCache.set(task.id, { task });
      
      if (task.googleTaskId) {
        syncContext.tasksByGoogleId.set(task.googleTaskId, task);
      }
    }
    
    // Build parent-child relationship map
    syncContext.parentChildMap = this.buildParentChildMaps(localTasks);
    
    this.log('info', `Cached ${localTasks.length} local tasks`, {
      tasksWithGoogleId: syncContext.tasksByGoogleId.size,
      parentTasks: syncContext.parentChildMap.size
    });
  }

  /**
   * Optimized category-based sync processing
   */
  private async processCategoryBasedSyncOptimized(syncContext: SyncContext, stats: any): Promise<any> {
    const { userEmail, settings } = syncContext;
    
    this.log('info', 'Processing category-based sync');
    
    // Get all relevant task lists for this user
    const relevantTaskLists = await this.getAllRelevantTaskLists(userEmail, settings);
    
    this.log('info', `Found ${relevantTaskLists.length} relevant task lists`, { lists: relevantTaskLists });

    // Collect all Google tasks from relevant task lists with error handling
    const validTaskLists: string[] = [];
    const invalidTaskLists: string[] = [];
    const allGoogleTasks: tasks_v1.Schema$Task[] = [];
    
    for (const taskListId of relevantTaskLists) {
      try {
        const listTasks = await googleTasksIntegration.getTasks(userEmail, taskListId);
        
        // Add task list info to each task and cache them
        for (const task of listTasks) {
          if (task.id) {
            (task as any)._taskListId = taskListId;
            syncContext.googleTasksCache.set(task.id, {
              task,
              taskListId
            });
            allGoogleTasks.push(task);
          }
        }
        
        validTaskLists.push(taskListId);
        
        this.log('info', `Retrieved ${listTasks.length} tasks from task list`, {
          taskListId,
          taskListTitle: await this.getTaskListTitle(userEmail, taskListId)
        });
      } catch (error) {
        this.log('warn', `Failed to get tasks from list "${taskListId}"`, error);
        
        // Check if this is a "not found" error (404)
        if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
          this.log('warn', `Task list "${taskListId}" no longer exists, will clean up reference`);
          invalidTaskLists.push(taskListId);
        }
      }
    }
    
    // Clean up invalid task list references from settings
    if (invalidTaskLists.length > 0) {
      this.log('info', `Cleaning up ${invalidTaskLists.length} invalid task list references`);
      await this.cleanupInvalidTaskListReferences(userEmail, invalidTaskLists, settings);
    }

    // Build Google parent-child relationships
    syncContext.googleParentChildMap = this.buildGoogleParentChildMaps(allGoogleTasks);

    this.log('info', `Total Google tasks retrieved: ${allGoogleTasks.length}`, {
      validTaskLists: validTaskLists.length,
      invalidTaskLists: invalidTaskLists.length,
      parentTasks: syncContext.googleParentChildMap.size
    });

    // Process sync from Google to local (with parent-child preservation)
    if (settings.syncDirection === 'bidirectional' || settings.syncDirection === 'google-to-app') {
      stats = await this.syncGoogleTasksToLocal(syncContext, allGoogleTasks, stats);
    }

    // Process sync from local to Google (with parent-child preservation)
    if (settings.syncDirection === 'bidirectional' || settings.syncDirection === 'app-to-google') {
      stats = await this.syncLocalTasksToGoogle(syncContext, stats);
    }

    return stats;
  }

  /**
   * Sync Google tasks to local tasks with parent-child relationship preservation
   */
  private async syncGoogleTasksToLocal(
    syncContext: SyncContext, 
    googleTasks: tasks_v1.Schema$Task[], 
    stats: any
  ): Promise<any> {
    // Sort Google tasks by parent-child relationships (parents first)
    const sortedGoogleTasks = this.sortGoogleTasksByParentChild(googleTasks);

    for (const googleTask of sortedGoogleTasks) {
      if (!googleTask.id) continue;
      
      stats.googleTasksProcessed++;
      
      // Handle deleted Google tasks
      if (googleTask.deleted) {
        await this.handleDeletedGoogleTask(syncContext, googleTask, stats);
        continue;
      }

      // Find matching local task
      const localTask = syncContext.tasksByGoogleId.get(googleTask.id);

      if (localTask) {
        // Update existing local task if Google version is newer
        const updated = await this.updateLocalTaskFromGoogle(syncContext, localTask, googleTask);
        if (updated) {
          stats.updatedLocal++;
        }
      } else {
        // Create new local task from Google task
        await this.createLocalTaskFromGoogle(syncContext, googleTask);
        stats.createdLocal++;
      }
    }

    return stats;
  }

  /**
   * Sync local tasks to Google tasks with parent-child relationship preservation
   */
  private async syncLocalTasksToGoogle(syncContext: SyncContext, stats: any): Promise<any> {
    const { settings } = syncContext;
    
    // Filter tasks that should be synced
    const tasksToSync = Array.from(syncContext.localTasksCache.values())
      .map(entry => entry.task)
      .filter(task => this.shouldSyncTask(task));

    // Sort tasks by parent-child relationships (parents first)
    const sortedTasks = this.sortTasksByParentChild(tasksToSync);

    for (const task of sortedTasks) {
      stats.localTasksSynced++;
      
      if (task.googleTaskId) {
        // Verify Google task still exists and update if needed
        const exists = await this.verifyAndUpdateGoogleTask(syncContext, task);
        if (exists) {
          stats.updatedGoogle++;
        } else {
          // Google task was deleted, recreate if needed
          const recreated = await this.handleMissingGoogleTask(syncContext, task);
          if (recreated) {
            stats.createdGoogle++;
          }
        }
      } else {
        // Create new Google task
        await this.createGoogleTaskFromLocal(syncContext, task);
        stats.createdGoogle++;
      }
    }

    return stats;
  }

  /**
   * Sort Google tasks by parent-child relationships (parents first)
   */
  private sortGoogleTasksByParentChild(googleTasks: tasks_v1.Schema$Task[]): tasks_v1.Schema$Task[] {
    const parentTasks: tasks_v1.Schema$Task[] = [];
    const childTasks: tasks_v1.Schema$Task[] = [];

    // Separate parent and child tasks
    googleTasks.forEach(task => {
      if (task.parent) {
        childTasks.push(task);
      } else {
        parentTasks.push(task);
      }
    });

    // Build sorted list: parents first, then their children
    const sorted: tasks_v1.Schema$Task[] = [];
    
    parentTasks.forEach(parent => {
      sorted.push(parent);
      // Add all children of this parent
      if (parent.id) {
        const children = childTasks.filter(child => child.parent === parent.id);
        sorted.push(...children);
      }
    });

    // Add any orphaned child tasks
    const addedChildren = new Set(sorted.filter(t => t.parent).map(t => t.id).filter(Boolean));
    const orphanedChildren = childTasks.filter(child => child.id && !addedChildren.has(child.id));
    sorted.push(...orphanedChildren);

    return sorted;
  }

  /**
   * Handle deleted Google task based on user preferences
   */
  private async handleDeletedGoogleTask(
    syncContext: SyncContext, 
    googleTask: tasks_v1.Schema$Task, 
    stats: any
  ): Promise<void> {
    const localTask = syncContext.tasksByGoogleId.get(googleTask.id!);
    
    if (!localTask) return;

    if (syncContext.settings.onDeletedTasksAction === 'skip') {
      // Skip deleted Google task
    } else if (syncContext.settings.onDeletedTasksAction === 'recreate') {
      // Will recreate deleted Google task in next sync cycle
    }
  }

  /**
   * Update local task from Google task if Google version is newer
   */
  private async updateLocalTaskFromGoogle(
    syncContext: SyncContext, 
    localTask: Task, 
    googleTask: tasks_v1.Schema$Task
  ): Promise<boolean> {
    const googleUpdated = new Date(googleTask.updated || '');
    const localUpdated = localTask.updatedAt ? new Date(localTask.updatedAt) : new Date(0);

    if (googleUpdated <= localUpdated) {
      return false; // No update needed
    }

    const updates: any = {
      title: googleTask.title || localTask.title,
      description: googleTask.notes || localTask.description,
      updatedAt: googleUpdated.getTime()
    };

    // Handle completion status
    if (googleTask.status === 'completed' && !localTask.completedAt) {
      updates.completedAt = googleUpdated.getTime();
    } else if (googleTask.status === 'needsAction' && localTask.completedAt) {
      updates.completedAt = null;
    }

    // Handle due date
    if (googleTask.due) {
      updates.scheduledAt = new Date(googleTask.due).getTime();
    }

    // Handle parent relationship (preserve local parent if it exists in Google)
    if (googleTask.parent) {
      const parentTask = syncContext.tasksByGoogleId.get(googleTask.parent);
      if (parentTask) {
        updates.parentId = parentTask.id;
      }
    }

    // Queue update operation
    syncContext.firebaseWriteQueue.push(async () => {
      await taskService.updateTask(localTask.id, updates);
    });

    this.log('info', `Queued local task update from Google: ${localTask.id}`);
    return true;
  }

  /**
   * Verify and update Google task if it exists and needs updating
   */
  private async verifyAndUpdateGoogleTask(syncContext: SyncContext, task: Task): Promise<boolean> {
    if (!task.googleTaskId) return false;

    const googleTaskEntry = syncContext.googleTasksCache.get(task.googleTaskId);
    
    if (!googleTaskEntry) {
      // Google task doesn't exist in our cache, might have been deleted
      return false;
    }

    const googleTask = googleTaskEntry.task;
    
    // Check if local task is newer and needs to update Google task
    const localUpdated = task.updatedAt ? new Date(task.updatedAt) : new Date(0);
    const googleUpdated = new Date(googleTask.updated || '');

    if (localUpdated <= googleUpdated) {
      return true; // Google task exists but no update needed
    }

    // Determine correct task list
    const targetTaskListId = await this.getTaskListForTask(syncContext.userEmail, task, syncContext.settings);
    
    // Check if task needs to be moved to a different task list
    if (googleTaskEntry.taskListId !== targetTaskListId) {
      this.log('info', `Moving task to different task list`, {
        taskId: task.googleTaskId,
        from: googleTaskEntry.taskListId,
        to: targetTaskListId
      });
      
      // Delete from old list and create in new list
      await googleTasksIntegration.deleteTask(syncContext.userEmail, googleTaskEntry.taskListId, task.googleTaskId);
      
      const parentGoogleTaskId = await this.getParentGoogleTaskId(syncContext, task);
      const createdTask = await googleTasksIntegration.createTask(
        syncContext.userEmail,
        task,
        targetTaskListId,
        parentGoogleTaskId
      );
      
      // Update sync data
      if (createdTask.id) {
        syncContext.firebaseWriteQueue.push(async () => {
          await googleTasksService.syncTaskToGoogleTasks(syncContext.userEmail, task.id, {
            googleTaskId: createdTask.id || undefined,
            syncStatus: 'synced',
            lastSync: Date.now(),
            googleTaskUrl: createdTask.selfLink || undefined,
            taskListId: targetTaskListId
          });
        });
      }
    } else {
      // Update in same task list
      const parentGoogleTaskId = await this.getParentGoogleTaskId(syncContext, task);
      
      await googleTasksIntegration.updateTask(
        syncContext.userEmail,
        task.googleTaskId,
        task,
        targetTaskListId,
        parentGoogleTaskId
      );
      
      // Update sync data
      syncContext.firebaseWriteQueue.push(async () => {
        await googleTasksService.syncTaskToGoogleTasks(syncContext.userEmail, task.id, {
          syncStatus: 'synced',
          lastSync: Date.now(),
          taskListId: targetTaskListId
        });
      });
    }

    this.log('info', `Updated Google task: ${task.googleTaskId}`);
    return true;
  }

  /**
   * Handle missing Google task (recreate if needed)
   */
  private async handleMissingGoogleTask(syncContext: SyncContext, task: Task): Promise<boolean> {
    if (syncContext.settings.onDeletedTasksAction !== 'recreate') {
      this.log('info', `Unlinking missing Google task from local task: ${task.id}`);
      
      // Unlink the missing Google task
      syncContext.firebaseWriteQueue.push(async () => {
        await googleTasksService.syncTaskToGoogleTasks(syncContext.userEmail, task.id, {
          googleTaskId: undefined,
          syncStatus: 'pending',
          lastSync: Date.now()
        });
      });
      
      return false;
    }

    this.log('info', `Recreating missing Google task for: ${task.title}`);
    
    // Determine target task list
    const taskListId = await this.getTaskListForTask(syncContext.userEmail, task, syncContext.settings);
    const parentGoogleTaskId = await this.getParentGoogleTaskId(syncContext, task);

    try {
      const createdTask = await googleTasksIntegration.createTask(
        syncContext.userEmail,
        task,
        taskListId,
        parentGoogleTaskId
      );
      
      if (createdTask.id) {
        // Update sync data
        syncContext.firebaseWriteQueue.push(async () => {
          await googleTasksService.syncTaskToGoogleTasks(syncContext.userEmail, task.id, {
            googleTaskId: createdTask.id || undefined,
            syncStatus: 'synced',
            lastSync: Date.now(),
            googleTaskUrl: createdTask.selfLink || undefined,
            taskListId: taskListId
          });
        });
        
        // Update cache
        syncContext.tasksByGoogleId.set(createdTask.id, task);
        syncContext.googleTasksCache.set(createdTask.id, {
          task: createdTask,
          taskListId
        });
        
        this.log('success', `Recreated Google task: ${createdTask.id}`);
        return true;
      }
    } catch (error) {
      this.log('error', `Failed to recreate Google task for: ${task.title}`, error);
    }
    
    return false;
  }

  /**
   * Create new Google task from local task
   */
  private async createGoogleTaskFromLocal(syncContext: SyncContext, task: Task): Promise<void> {
    // Determine target task list with validation
    let taskListId = await this.getTaskListForTask(syncContext.userEmail, task, syncContext.settings);
    
    // Validate that the task list exists, fall back to default if not
    try {
      // Check if we have tasks cached for this list
      const cachedTasksForList = Array.from(syncContext.googleTasksCache.values())
        .filter(entry => entry.taskListId === taskListId);
      if (cachedTasksForList.length === 0) {
        // If no cached tasks, fetch to validate
        await googleTasksIntegration.getTasks(syncContext.userEmail, taskListId);
      }
    } catch (error) {
      // Fall back to default task list
      taskListId = syncContext.settings.defaultTaskListId || '@default';
      
      // If we're in category-based mode, try to create/get the correct category list
      if (syncContext.settings.syncMode === 'category-based') {
        try {
          const category = task.category || 'Uncategorized';
          taskListId = await categoryTaskListManager.getOrCreateCategoryTaskList(syncContext.userEmail, category);
        } catch (categoryError) {
          // Use default
        }
      }
    }
    
    try {
      // Check for duplicates before creating using cached tasks
      const existingGoogleTasks = Array.from(syncContext.googleTasksCache.values())
        .filter(entry => entry.taskListId === taskListId)
        .map(entry => entry.task);
      const parentGoogleTaskId = await this.getParentGoogleTaskId(syncContext, task);
      
      const duplicateTask = existingGoogleTasks.find(gTask => 
        gTask.title === task.title && 
        gTask.notes === task.description &&
        Math.abs((gTask.due ? new Date(gTask.due).getTime() : 0) - (task.reminderAt || 0)) < 24 * 60 * 60 * 1000 && // Within 24 hours
        gTask.parent === parentGoogleTaskId // Same parent relationship
      );

      if (duplicateTask && duplicateTask.id) {
        console.log(`Found existing Google task, linking instead of creating duplicate: ${duplicateTask.title}`);
        
        // Link to existing task
        syncContext.firebaseWriteQueue.push(async () => {
          await googleTasksService.syncTaskToGoogleTasks(syncContext.userEmail, task.id, {
            googleTaskId: duplicateTask.id!,
            syncStatus: 'synced',
            lastSync: Date.now(),
            googleTaskUrl: duplicateTask.selfLink || undefined,
            taskListId: taskListId
          });
        });
        
        // Update cache
        syncContext.tasksByGoogleId.set(duplicateTask.id, task);
        return;
      }

      // Create new Google task
      const createdTask = await googleTasksIntegration.createTask(
        syncContext.userEmail,
        task,
        taskListId,
        parentGoogleTaskId
      );
      
      if (createdTask.id) {
        // Update sync data
        syncContext.firebaseWriteQueue.push(async () => {
          await googleTasksService.syncTaskToGoogleTasks(syncContext.userEmail, task.id, {
            googleTaskId: createdTask.id || undefined,
            syncStatus: 'synced',
            lastSync: Date.now(),
            googleTaskUrl: createdTask.selfLink || undefined,
            taskListId: taskListId
          });
        });
        
        // Update cache with the new Google Task ID
        syncContext.tasksByGoogleId.set(createdTask.id, task);
        syncContext.googleTasksCache.set(createdTask.id, {
          task: createdTask,
          taskListId
        });
        
        // Update local task cache with the Google Task ID so child tasks can find it
        const localTaskCacheEntry = syncContext.localTasksCache.get(task.id);
        if (localTaskCacheEntry) {
          localTaskCacheEntry.task.googleTaskId = createdTask.id;
        }
        
        // Note: Logging is handled in googleTasksIntegration.createTask
      }
    } catch (error) {
      console.error(`Failed to create Google task for: ${task.title}`);
    }
  }

  /**
   * Get parent Google task ID for a given task
   */
  private async getParentGoogleTaskId(syncContext: SyncContext, task: Task): Promise<string | undefined> {
    if (!task.parentId) return undefined;
    
    // First, check the cache (already processed parent)
    const parentTaskEntry = syncContext.localTasksCache.get(task.parentId);
    if (parentTaskEntry?.task.googleTaskId) {
      return parentTaskEntry.task.googleTaskId;
    }
    
    // If not in cache, check if parent task exists in local database
    try {
      const parentTask = await taskService.getTask(task.parentId);
      if (parentTask?.googleTaskId) {
        return parentTask.googleTaskId;
      }
    } catch (error) {
      // Failed to get parent task
    }
    
    // Parent doesn't have a Google Task ID yet
    return undefined;
  }

  /**
   * Get task list title for better logging
   */
  private async getTaskListTitle(userEmail: string, taskListId: string): Promise<string> {
    try {
      const taskLists = await googleTasksIntegration.getTaskLists(userEmail);
      const taskList = taskLists.find(list => list.id === taskListId);
      return taskList?.title || taskListId;
    } catch (error) {
      return taskListId;
    }
  }

  /**
   * Check if a task should be synced based on current sync settings
   */
  private async createLocalTaskFromGoogle(
    syncContext: SyncContext, 
    googleTask: tasks_v1.Schema$Task
  ): Promise<void> {
    // Determine category from task list (for category-based mode)
    let category = 'General';
    const taskListId = (googleTask as any)._taskListId;
    
    if (syncContext.settings.syncMode === 'category-based' && taskListId && syncContext.settings.taskListPrefix) {
      const taskListTitle = await this.getTaskListTitle(syncContext.userEmail, taskListId);
      const prefix = syncContext.settings.taskListPrefix;
      
      if (taskListTitle.startsWith(prefix)) {
        const extractedCategory = taskListTitle.substring(prefix.length).trim();
        if (extractedCategory && !extractedCategory.toLowerCase().includes('archived')) {
          category = extractedCategory;
        }
      }
    }

    // Handle parent relationship
    let parentId: string | undefined;
    if (googleTask.parent) {
      const parentTask = syncContext.tasksByGoogleId.get(googleTask.parent);
      parentId = parentTask?.id;
    }

    const newTask = {
      title: googleTask.title || '',
      description: googleTask.notes || '',
      category: category,
      priority: 'Medium' as const,
      duration: 60,
      rejectionCount: 0,
      isMuted: false,
      parentId,
      scheduledAt: googleTask.due ? new Date(googleTask.due).getTime() : undefined,
      completedAt: googleTask.status === 'completed' ? new Date(googleTask.updated || '').getTime() : undefined,
      isArchived: taskListId === syncContext.settings.archivedTaskListId,
      googleTaskId: googleTask.id || null,
      syncToGoogleTasks: true,
      createdAt: Date.now(),
      updatedAt: new Date(googleTask.updated || '').getTime()
    };

    // Queue create operation
    syncContext.firebaseWriteQueue.push(async () => {
      const taskId = await taskService.addTask(syncContext.userEmail, newTask as Omit<Task, "userEmail" | "id">);
      
      // Update caches
      const fullTask: Task = { ...newTask, id: taskId, userEmail: syncContext.userEmail } as Task;
      syncContext.localTasksCache.set(taskId, { task: fullTask });
      if (googleTask.id) {
        syncContext.tasksByGoogleId.set(googleTask.id, fullTask);
      }
    });

    console.log(`Created local task: ${googleTask.title}${parentId ? ` (subtask of ${parentId})` : ''}`);
  }
  private shouldSyncTask(task: Task): boolean {
    // Skip explicitly disabled tasks
    if (task.syncToGoogleTasks === false) {
      return false;
    }
    
    // Skip ALL completed tasks - they should not be synced to Google Tasks
    if (task.completedAt) {
      return false;
    }
    
    // Include only uncompleted tasks
    return true;
  }

  /**
   * Optimized single-list sync processing
   */
  private async processSingleListSyncOptimized(syncContext: SyncContext, stats: any): Promise<any> {
    const { userEmail, settings } = syncContext;
    
    // Get Google tasks with verification
    const googleTasks = await googleTasksIntegration.getTasks(userEmail, settings.defaultTaskListId || '@default');
    
    // Cache Google tasks and build parent-child relationships
    for (const googleTask of googleTasks) {
      if (googleTask.id) {
        syncContext.googleTasksCache.set(googleTask.id, {
          task: googleTask,
          taskListId: settings.defaultTaskListId || '@default'
        });
      }
    }
    
    syncContext.googleParentChildMap = this.buildGoogleParentChildMaps(googleTasks);

    // Process sync from Google to local (with parent-child preservation)
    if (settings.syncDirection === 'bidirectional' || settings.syncDirection === 'google-to-app') {
      stats = await this.syncGoogleTasksToLocal(syncContext, googleTasks, stats);
    }

    // Process sync from local to Google (with parent-child preservation)
    if (settings.syncDirection === 'bidirectional' || settings.syncDirection === 'app-to-google') {
      stats = await this.syncLocalTasksToGoogle(syncContext, stats);
    }

    return stats;
  }
  private async performSync(userEmail: string, settings: GoogleTasksSettings): Promise<{
    success: boolean;
    synced: number;
    conflicts: SyncConflict[];
    errors: string[];
  }> {
    const conflicts: SyncConflict[] = [];
    const errors: string[] = [];
    let synced = 0;

    try {
      // Get tasks from both sources
      const [appTasks, googleTasks] = await Promise.all([
        taskService.getTasks(userEmail),
        googleTasksIntegration.getTasks(userEmail, settings.defaultTaskListId)
      ]);

      // Create maps for easier lookup
      const appTasksMap = new Map<string, Task>();
      const googleTasksMap = new Map<string, tasks_v1.Schema$Task>();
      const appTasksByGoogleId = new Map<string, Task>();

      // Populate maps
      appTasks.forEach(task => {
        appTasksMap.set(task.id, task);
        if (task.googleTaskId) {
          appTasksByGoogleId.set(task.googleTaskId, task);
        }
      });

      googleTasks.forEach(task => {
        if (task.id) {
          googleTasksMap.set(task.id, task);
        }
      });

      // Sync direction based on settings
      const direction = settings.syncDirection || 'bidirectional';

      if (direction === 'app-to-google' || direction === 'bidirectional') {
        console.log(`🔄 Syncing ${appTasks.length} app tasks to Google Tasks`);
        
        // Push app tasks to Google Tasks
        for (const appTask of appTasks) {
          if (!appTask.syncToGoogleTasks) continue;

          try {
            if (appTask.googleTaskId) {
              // Update existing Google task
              const googleTask = googleTasksMap.get(appTask.googleTaskId);
              if (googleTask) {
                if (this.shouldUpdateGoogleTask(appTask, googleTask)) {
                  console.log(`🔧 Updating Google task: ${appTask.googleTaskId} - ${appTask.title}`);
                  
                  // Determine the task list for this task
                  const taskListId = await this.getTaskListForTask(userEmail, appTask, settings);
                  
                  await googleTasksIntegration.updateTask(userEmail, appTask.googleTaskId, appTask, taskListId);
                  await googleTasksService.syncTaskToGoogleTasks(userEmail, appTask.id, {
                    syncStatus: 'synced',
                    lastSync: Date.now(),
                    taskListId: taskListId
                  });
                  synced++;
                }
              } else {
                // Google task was deleted - handle based on user preference
                const onDeletedAction = settings.onDeletedTasksAction || 'skip';
                console.log(`🗑️ Google task ${appTask.googleTaskId} was deleted`);
                
                if (onDeletedAction === 'recreate') {
                  console.log(`🔄 Recreating deleted Google task for app task ${appTask.id}: ${appTask.title}`);
                  // Recreate the Google task
                  try {
                    // Determine the task list for this task
                    const taskListId = await this.getTaskListForTask(userEmail, appTask, settings);
                    
                    // Get parent Google task ID if this is a subtask
                    let parentGoogleTaskId: string | undefined;
                    if (appTask.parentId) {
                      const parentAppTask = appTasks.find(t => t.id === appTask.parentId);
                      parentGoogleTaskId = parentAppTask?.googleTaskId || undefined;
                    }

                    const recreatedTask = await googleTasksIntegration.createTask(
                      userEmail, 
                      appTask, 
                      taskListId,
                      parentGoogleTaskId
                    );
                    
                    if (recreatedTask.id) {
                      await googleTasksService.syncTaskToGoogleTasks(userEmail, appTask.id, {
                        googleTaskId: recreatedTask.id,
                        syncStatus: 'synced',
                        lastSync: Date.now(),
                        googleTaskUrl: recreatedTask.selfLink || undefined,
                        taskListId: taskListId
                      });
                      console.log(`✅ Recreated Google task: ${recreatedTask.id} for app task ${appTask.id}`);
                      synced++;
                    }
                  } catch (error) {
                    console.error(`❌ Failed to recreate Google task for app task ${appTask.id}:`, error);
                    errors.push(`Failed to recreate task "${appTask.title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
                  }
                } else {
                  // Default behavior: just unlink
                  console.log(`⏭️ Unlinking deleted Google task from app task ${appTask.id}: ${appTask.title}`);
                  await googleTasksService.syncTaskToGoogleTasks(userEmail, appTask.id, {
                    googleTaskId: undefined,
                    syncStatus: 'pending',
                    lastSync: Date.now()
                  });
                  // Will be re-created in next sync iteration if user changes setting
                }
              }
            } else {
              // Check for duplicates before creating
              const duplicateTask = googleTasks.find(gTask => 
                gTask.title === appTask.title && 
                gTask.notes === appTask.description &&
                !appTasksByGoogleId.has(gTask.id!) // Not already linked to another app task
              );

              if (duplicateTask) {
                console.log(`🔗 Linking to existing Google task: ${duplicateTask.id} - ${duplicateTask.title}`);
                // Link to existing task instead of creating duplicate
                await googleTasksService.syncTaskToGoogleTasks(userEmail, appTask.id, {
                  googleTaskId: duplicateTask.id!,
                  syncStatus: 'synced',
                  lastSync: Date.now(),
                  googleTaskUrl: duplicateTask.selfLink || undefined
                });
                synced++;
              } else {
                // Create new Google task
                console.log(`🆕 Creating new Google task: ${appTask.title}`);
                const createdTask = await googleTasksIntegration.createTask(userEmail, appTask, settings.defaultTaskListId);
                if (createdTask.id) {
                  await googleTasksService.syncTaskToGoogleTasks(userEmail, appTask.id, {
                    googleTaskId: createdTask.id,
                    syncStatus: 'synced',
                    lastSync: Date.now(),
                    googleTaskUrl: createdTask.selfLink || undefined
                  });
                  synced++;
                }
              }
            }
          } catch (error) {
            errors.push(`Failed to sync app task "${appTask.title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      if (direction === 'google-to-app' || direction === 'bidirectional') {
        console.log(`🔄 Syncing ${googleTasks.length} Google tasks to app`);
        
        // Pull Google tasks to app
        for (const googleTask of googleTasks) {
          if (!googleTask.id) continue;

          try {
            const appTask = appTasksByGoogleId.get(googleTask.id);
            
            if (appTask) {
              // Update existing app task
              if (this.shouldUpdateAppTask(appTask, googleTask)) {
                console.log(`🔧 Updating app task: ${appTask.id} - ${appTask.title}`);
                const updatedTask = this.mergeGoogleTaskToAppTask(appTask, googleTask);
                await taskService.updateTask(appTask.id, updatedTask);
                synced++;
              }
            } else {
              // Check for duplicates by title before creating
              const duplicateAppTask = appTasks.find(aTask => 
                aTask.title === googleTask.title && 
                aTask.description === googleTask.notes &&
                !aTask.googleTaskId // Not already linked to a Google task
              );

              if (duplicateAppTask) {
                console.log(`🔗 Linking existing app task to Google task: ${duplicateAppTask.id} -> ${googleTask.id}`);
                // Link existing app task to this Google task
                await googleTasksService.syncTaskToGoogleTasks(userEmail, duplicateAppTask.id, {
                  googleTaskId: googleTask.id,
                  syncStatus: 'synced',
                  lastSync: Date.now(),
                  googleTaskUrl: googleTask.selfLink || undefined
                });
                synced++;
              } else {
                // Create new app task from Google task
                console.log(`🆕 Creating new app task from Google task: ${googleTask.title}`);
                const newAppTask = googleTasksIntegration.convertGoogleTaskToAppTask(googleTask, userEmail);
                const taskId = await taskService.addTask(userEmail, newAppTask as Omit<Task, "userEmail" | "id">);
                
                // Link the new app task to the Google task
                await googleTasksService.syncTaskToGoogleTasks(userEmail, taskId, {
                  googleTaskId: googleTask.id,
                  syncStatus: 'synced',
                  lastSync: Date.now(),
                  googleTaskUrl: googleTask.selfLink || undefined
                });
                synced++;
              }
            }
          } catch (error) {
            errors.push(`Failed to sync Google task "${googleTask.title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      return {
        success: errors.length === 0,
        synced,
        conflicts,
        errors
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if Google task should be updated based on app task
   */
  private shouldUpdateGoogleTask(appTask: Task, googleTask: tasks_v1.Schema$Task): boolean {
    const appLastModified = appTask.googleTaskLastSync || appTask.updatedAt || appTask.createdAt;
    const googleLastModified = googleTask.updated ? new Date(googleTask.updated).getTime() : 0;

    // If app task was modified after last sync, update Google task
    return appLastModified > googleLastModified;
  }

  /**
   * Check if app task should be updated based on Google task
   */
  private shouldUpdateAppTask(appTask: Task, googleTask: tasks_v1.Schema$Task): boolean {
    const appLastModified = appTask.updatedAt || appTask.createdAt;
    const googleLastModified = googleTask.updated ? new Date(googleTask.updated).getTime() : 0;
    const lastSync = appTask.googleTaskLastSync || 0;

    // If Google task was modified after last sync and after app task, update app task
    return googleLastModified > Math.max(appLastModified, lastSync);
  }

  /**
   * Merge Google task data into app task
   */
  private mergeGoogleTaskToAppTask(appTask: Task, googleTask: tasks_v1.Schema$Task): Partial<Task> {
    const updates: Partial<Task> = {
      title: googleTask.title || appTask.title,
      description: googleTask.notes || appTask.description,
      reminderAt: googleTask.due ? new Date(googleTask.due).getTime() : appTask.reminderAt,
      googleTaskSyncStatus: 'synced',
      googleTaskLastSync: Date.now(),
      updatedAt: Date.now()
    };

    // Handle completion status
    if (googleTask.status === 'completed') {
      updates.completedAt = googleTask.completed 
        ? new Date(googleTask.completed).getTime() 
        : (appTask.completedAt || Date.now());
    } else {
      updates.completedAt = undefined;
    }

    return updates;
  }

  /**
   * Push a single task change to Google Tasks with improved error handling and parent-child support
   */
  async pushTaskChange(userEmail: string, taskId: string): Promise<void> {
    try {
      const task = await taskService.getTask(taskId);
      if (!task) {
        return;
      }

      if (!task.syncToGoogleTasks) {
        return;
      }

      // Skip old completed tasks (only sync recently completed tasks)
      if (task.completedAt && !this.shouldSyncCompletedTask(task)) {
        return;
      }

      // Get verified settings
      const settings = await this.getVerifiedSettings(userEmail);
      if (!settings?.isConnected || !settings?.syncEnabled) {
        return;
      }

      // Verify parent task is synced first (important for parent-child relationships)
      let parentGoogleTaskId: string | undefined;
      if (task.parentId) {
        const parentTask = await taskService.getTask(task.parentId);
        if (parentTask?.googleTaskId) {
          // Verify parent Google task still exists
          const parentExists = await this.verifyGoogleTaskExists(userEmail, parentTask.googleTaskId, 
            await this.getTaskListForTask(userEmail, parentTask, settings));
          
          if (parentExists) {
            parentGoogleTaskId = parentTask.googleTaskId;
          } else {
            // Sync parent task first
            if (parentTask?.syncToGoogleTasks) {
              await this.pushTaskChange(userEmail, task.parentId);
              // Re-fetch parent to get the updated Google task ID
              const updatedParent = await taskService.getTask(task.parentId);
              parentGoogleTaskId = updatedParent?.googleTaskId || undefined;
            }
          }
        } else {
          // Sync parent task first if it doesn't have a Google task ID
          if (parentTask?.syncToGoogleTasks) {
            await this.pushTaskChange(userEmail, task.parentId);
            // Re-fetch parent to get the Google task ID
            const updatedParent = await taskService.getTask(task.parentId);
            parentGoogleTaskId = updatedParent?.googleTaskId || undefined;
          }
        }
      }

      if (task.googleTaskId) {
        // Verify Google task still exists
        const taskListId = await this.getTaskListForTask(userEmail, task, settings);
        const exists = await this.verifyGoogleTaskExists(userEmail, task.googleTaskId, taskListId);
        
        if (exists) {
          // Update existing Google task
          await googleTasksIntegration.updateTask(userEmail, task.googleTaskId, task, taskListId, parentGoogleTaskId);
          
          await googleTasksService.syncTaskToGoogleTasks(userEmail, task.id, {
            syncStatus: 'synced',
            lastSync: Date.now(),
            taskListId: taskListId
          });
        } else {
          // Google task was deleted, handle based on user preference
          if (settings.onDeletedTasksAction === 'recreate') {
            const taskListId = await this.getTaskListForTask(userEmail, task, settings);
            
            const recreatedTask = await googleTasksIntegration.createTask(
              userEmail, 
              task, 
              taskListId,
              parentGoogleTaskId
            );
            
            if (recreatedTask.id) {
              await googleTasksService.syncTaskToGoogleTasks(userEmail, task.id, {
                googleTaskId: recreatedTask.id,
                syncStatus: 'synced',
                lastSync: Date.now(),
                googleTaskUrl: recreatedTask.selfLink || undefined,
                taskListId: taskListId
              });
            }
          } else {
            // Unlink the deleted Google task
            await googleTasksService.syncTaskToGoogleTasks(userEmail, task.id, {
              googleTaskId: undefined,
              syncStatus: 'pending',
              lastSync: Date.now()
            });
          }
        }
      } else {
        // Determine the task list for this task
        const taskListId = await this.getTaskListForTask(userEmail, task, settings);
        
        // Check for duplicates before creating
        const existingGoogleTasks = await googleTasksIntegration.getTasks(userEmail, taskListId);
        const duplicateTask = existingGoogleTasks.find(gTask => 
          gTask.title === task.title && 
          gTask.notes === task.description &&
          Math.abs((gTask.due ? new Date(gTask.due).getTime() : 0) - (task.reminderAt || 0)) < 24 * 60 * 60 * 1000 && // Within 24 hours
          gTask.parent === parentGoogleTaskId // Same parent relationship
        );

        if (duplicateTask) {
          // Link to existing task instead of creating duplicate
          await googleTasksService.syncTaskToGoogleTasks(userEmail, task.id, {
            googleTaskId: duplicateTask.id!,
            syncStatus: 'synced',
            lastSync: Date.now(),
            googleTaskUrl: duplicateTask.selfLink || undefined,
            taskListId: taskListId
          });
        } else {
          // Create new Google task (with proper parent relationship)
          const createdTask = await googleTasksIntegration.createTask(userEmail, task, taskListId, parentGoogleTaskId);
          if (createdTask.id) {
            await googleTasksService.syncTaskToGoogleTasks(userEmail, task.id, {
              googleTaskId: createdTask.id,
              syncStatus: 'synced',
              lastSync: Date.now(),
              googleTaskUrl: createdTask.selfLink || undefined,
              taskListId: taskListId
            });
            // Note: Logging is handled in googleTasksIntegration.createTask
          }
        }
      }
    } catch (error) {
      await googleTasksService.syncTaskToGoogleTasks(userEmail, taskId, {
        syncStatus: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Sync all old incomplete tasks with Google Tasks
   */
  async syncAllIncompleteTasksToGoogle(userEmail: string): Promise<{
    success: boolean;
    syncedCount: number;
    skippedCount: number;
    errors: string[];
  }> {
    try {
      const settings = await googleTasksService.getGoogleTasksSettings(userEmail);
      if (!settings || !settings.isConnected || !settings.syncEnabled) {
        throw new Error('Google Tasks not connected or sync disabled');
      }

      // Get all tasks that should be synced: incomplete tasks + recently completed tasks
      const allTasks = await taskService.getTasks(userEmail);
      const tasksToSync = allTasks.filter(task => {
        // Include incomplete tasks
        if (!task.completedAt && task.syncToGoogleTasks !== false) {
          return true;
        }
        // Include recently completed tasks that should be synced to archived list
        if (task.completedAt && this.shouldSyncCompletedTask(task) && task.syncToGoogleTasks !== false) {
          return true;
        }
        return false;
      });

      let syncedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      // Sort tasks so parent tasks are synced before their subtasks
      const sortedTasks = this.sortTasksByParentChild(tasksToSync);

      for (const task of sortedTasks) {
        try {
          // Skip if already synced
          if (task.googleTaskId) {
            skippedCount++;
            continue;
          }

          // Update task to enable sync if not explicitly set
          if (task.syncToGoogleTasks === undefined) {
            await taskService.updateTask(task.id, { syncToGoogleTasks: true });
          }

          // Sync the task
          await this.pushTaskChange(userEmail, task.id);
          syncedCount++;
          console.log(`Synced task: ${task.title}`);

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          const errorMsg = `Failed to sync task "${task.title}": ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

      console.log(`Bulk sync completed. Synced: ${syncedCount}, Skipped: ${skippedCount}, Errors: ${errors.length}`);

      return {
        success: errors.length === 0,
        syncedCount,
        skippedCount,
        errors
      };
    } catch (error) {
      console.error('❌ Error during bulk sync:', error);
      return {
        success: false,
        syncedCount: 0,
        skippedCount: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Sort tasks so parent tasks come before their subtasks
   */
  private sortTasksByParentChild(tasks: Task[]): Task[] {
    const taskMap = new Map<string, Task>();
    const parentTasks: Task[] = [];
    const childTasks: Task[] = [];

    // Separate parent and child tasks
    tasks.forEach(task => {
      taskMap.set(task.id, task);
      if (task.parentId) {
        childTasks.push(task);
      } else {
        parentTasks.push(task);
      }
    });

    // Build sorted list: parents first, then their children
    const sorted: Task[] = [];
    
    parentTasks.forEach(parent => {
      sorted.push(parent);
      // Add all children of this parent
      const children = childTasks.filter(child => child.parentId === parent.id);
      sorted.push(...children);
    });

    // Add any orphaned child tasks (parent not in the list)
    const addedChildren = new Set(sorted.filter(t => t.parentId).map(t => t.id));
    const orphanedChildren = childTasks.filter(child => !addedChildren.has(child.id));
    sorted.push(...orphanedChildren);

    return sorted;
  }
  async syncTaskDeletion(userEmail: string, taskId: string, googleTaskId?: string): Promise<void> {
    if (!googleTaskId) return;

    try {
      const settings = await googleTasksService.getGoogleTasksSettings(userEmail);
      if (!settings || !settings.isConnected || !settings.syncEnabled) return;

      await googleTasksIntegration.deleteTask(userEmail, googleTaskId, settings.defaultTaskListId);
    } catch (error) {
      console.error('Error syncing task deletion:', error);
    }
  }

  /**
   * Resolve a sync conflict manually
   */
  async resolveConflict(
    userEmail: string,
    conflictType: 'keep_app' | 'keep_google' | 'merge',
    appTask: Task,
    googleTask: tasks_v1.Schema$Task
  ): Promise<void> {
    try {
      const settings = await googleTasksService.getGoogleTasksSettings(userEmail);
      if (!settings) throw new Error('Google Tasks not connected');

      switch (conflictType) {
        case 'keep_app':
          // Update Google task with app data
          if (googleTask.id) {
            await googleTasksIntegration.updateTask(userEmail, googleTask.id, appTask, settings.defaultTaskListId);
          }
          break;

        case 'keep_google':
          // Update app task with Google data
          const updatedTask = this.mergeGoogleTaskToAppTask(appTask, googleTask);
          await taskService.updateTask(appTask.id, updatedTask);
          break;

        case 'merge':
          // Implement custom merge logic
          const mergedTask: Partial<Task> = {
            title: appTask.title, // Keep app title
            description: googleTask.notes || appTask.description, // Prefer Google notes
            completedAt: (googleTask.status === 'completed' || appTask.completedAt) ? (appTask.completedAt || Date.now()) : undefined,
            reminderAt: appTask.reminderAt || (googleTask.due ? new Date(googleTask.due).getTime() : undefined)
          };
          
          await taskService.updateTask(appTask.id, mergedTask);
          if (googleTask.id) {
            await googleTasksIntegration.updateTask(userEmail, googleTask.id, { ...appTask, ...mergedTask } as Task, settings.defaultTaskListId);
          }
          break;
      }

      await googleTasksService.syncTaskToGoogleTasks(userEmail, appTask.id, {
        syncStatus: 'synced',
        lastSync: Date.now()
      });
    } catch (error) {
      console.error('Error resolving conflict:', error);
      throw error;
    }
  }

  /**
   * Perform interval-based sync for a user (called by comprehensive check)
   */
  async performIntervalSync(userEmail: string): Promise<{
    success: boolean;
    synced: number;
    conflicts: SyncConflict[];
    errors: string[];
    skipped: boolean;
    reason?: string;
  }> {
    try {
      const settings = await googleTasksService.getGoogleTasksSettings(userEmail);
      if (!settings || !settings.isConnected || !settings.syncEnabled) {
        return { 
          success: false, 
          synced: 0, 
          conflicts: [], 
          errors: ['Google Tasks not connected or sync disabled'],
          skipped: true,
          reason: 'Not connected or sync disabled'
        };
      }

      // Check sync direction - only process if bidirectional or google-to-app
      const syncDirection = settings.syncDirection || 'bidirectional';
      if (syncDirection === 'app-to-google') {
        return {
          success: true,
          synced: 0,
          conflicts: [],
          errors: [],
          skipped: true,
          reason: 'App-to-Google only sync direction'
        };
      }

      // Check if auto sync is enabled or if enough time has passed since last sync
      const lastSyncAt = settings.lastSyncAt || 0;
      const timeSinceLastSync = Date.now() - lastSyncAt;
      const syncIntervalMs = 30 * 60 * 1000; // 30 minutes

      const shouldSync = settings.autoSync || timeSinceLastSync > syncIntervalMs;

      if (!shouldSync) {
        return {
          success: true,
          synced: 0,
          conflicts: [],
          errors: [],
          skipped: true,
          reason: `Sync not due (last sync: ${new Date(lastSyncAt).toISOString()})`
        };
      }

      // Perform the actual sync
      const result = await this.syncUserTasks(userEmail);
      return {
        ...result,
        skipped: false
      };

    } catch (error) {
      console.error('Error during interval sync:', error);
      return {
        success: false,
        synced: 0,
        conflicts: [],
        errors: [error instanceof Error ? error.message : 'Unknown sync error'],
        skipped: false
      };
    }
  }

  /**
   * Process sync for single task list mode
   */
  private async processSingleTaskListSync(
    googleTasks: any[], 
    settings: GoogleTasksSettings, 
    stats: any
  ): Promise<any> {
    // Get local tasks from Firestore
    const localTasks = await taskService.getTasks(settings.userEmail || '');
    
    console.log('💾 Retrieved local tasks (single mode):', {
      count: localTasks.length,
      tasks: localTasks.map((t: Task) => ({
        id: t.id,
        title: t.title,
        isCompleted: !!t.completedAt,
        googleTaskId: t.googleTaskId,
        category: t.category,
        updatedAt: t.updatedAt ? new Date(t.updatedAt).toISOString() : 'no-update-time'
      }))
    });

    // Sync from Google Tasks to local
    for (const googleTask of googleTasks) {
      stats.googleTasksProcessed++;
      
      console.log(`🔍 Processing Google Task: ${googleTask.title}`, {
        id: googleTask.id,
        status: googleTask.status,
        updated: googleTask.updated,
        deleted: googleTask.deleted
      });

      // Handle deleted Google tasks
      if (googleTask.deleted) {
        console.log('🗑️ Found deleted Google Task:', googleTask.id);
        const localTask = localTasks.find((t: Task) => t.googleTaskId === googleTask.id);
        
        if (localTask) {
          console.log('🔧 Applying deleted task action:', settings.onDeletedTasksAction, 'to local task:', localTask.id);
          
          if (settings.onDeletedTasksAction === 'skip') {
            console.log('⏭️ Skipping deleted Google Task (user preference)');
          } else if (settings.onDeletedTasksAction === 'recreate') {
            // Recreate the task - handled by existing logic
            console.log('� Will recreate task in next sync cycle');
          }
        }
        continue;
      }

      // Find matching local task
      const localTask = localTasks.find((t: Task) => t.googleTaskId === googleTask.id);

      if (localTask) {
        // Update existing local task if Google version is newer
        const googleUpdated = new Date(googleTask.updated || '');
        const localUpdated = localTask.updatedAt ? new Date(localTask.updatedAt) : new Date(0);

        if (googleUpdated > localUpdated) {
          const updates: any = {
            title: googleTask.title || '',
            description: googleTask.notes || '',
            updatedAt: googleUpdated.getTime()
          };

          if (googleTask.status === 'completed' && !localTask.completedAt) {
            updates.completedAt = googleUpdated.getTime();
          } else if (googleTask.status === 'needsAction' && localTask.completedAt) {
            updates.completedAt = null;
          }

          if (googleTask.due) {
            updates.scheduledAt = new Date(googleTask.due).getTime();
          }

          await taskService.updateTask(localTask.id, updates);
          stats.updatedLocal++;
          console.log('🔄 Updated local task from Google:', localTask.id);
        }
      } else {
        // Create new local task
        const newTask = {
          title: googleTask.title || '',
          description: googleTask.notes || '',
          category: 'General', // Default category for Google-originated tasks
          priority: 'Medium' as const,
          duration: 60,
          rejectionCount: 0,
          isMuted: false,
          scheduledAt: googleTask.due ? new Date(googleTask.due).getTime() : undefined,
          completedAt: googleTask.status === 'completed' ? new Date(googleTask.updated || '').getTime() : undefined,
          googleTaskId: googleTask.id || null,
          createdAt: Date.now(),
          updatedAt: new Date(googleTask.updated || '').getTime()
        };

        await taskService.addTask(settings.userEmail || '', newTask as Omit<Task, "userEmail" | "id">);
        stats.createdLocal++;
        console.log('➕ Created local task from Google:', googleTask.id);
      }
    }

    // Sync from local to Google Tasks (if two-way sync is enabled)
    if (settings.syncDirection === 'bidirectional' || settings.syncDirection === 'app-to-google') {
      console.log('🔄 Starting two-way sync to Google Tasks (single mode)...');
      
      // Filter tasks: Only sync uncompleted tasks OR tasks that need to be archived
      const tasksToSync = localTasks.filter(task => {
        // Skip explicitly disabled tasks
        if (task.syncToGoogleTasks === false) {
          return false;
        }
        
        // Include uncompleted tasks (the main sync targets)
        if (!task.completedAt) {
          return true;
        }
        
        // Include tasks that are marked for archiving (isArchived: true)
        if (task.isArchived === true) {
          return true;
        }
        
        // Skip all other completed tasks
        console.log(`⏭️ Skipping completed task: ${task.title} (not marked for archiving)`);
        return false;
      });
      
      console.log(`📊 Filtered tasks for sync: ${tasksToSync.length} out of ${localTasks.length} total tasks`);
      
      for (const localTask of tasksToSync) {
        stats.localTasksSynced++;
        
        console.log(`🔍 Processing local task: ${localTask.title}`, {
          id: localTask.id,
          googleTaskId: localTask.googleTaskId,
          category: localTask.category,
          isCompleted: !!localTask.completedAt,
          isArchived: localTask.isArchived
        });

        if (localTask.googleTaskId) {
          // Update existing Google task
          const googleTask = googleTasks.find(t => t.id === localTask.googleTaskId);
          
          if (googleTask && !googleTask.deleted) {
            const localUpdated = localTask.updatedAt ? new Date(localTask.updatedAt) : new Date(0);
            const googleUpdated = new Date(googleTask.updated || '');

            if (localUpdated > googleUpdated) {
              const taskUpdate = {
                title: localTask.title,
                notes: localTask.description || '',
                status: localTask.completedAt ? 'completed' : 'needsAction',
                due: localTask.scheduledAt ? new Date(localTask.scheduledAt).toISOString().split('T')[0] : undefined
              };

              await googleTasksIntegration.updateTask(
                settings.userEmail || '', 
                localTask.googleTaskId, 
                localTask,
                settings.defaultTaskListId || '@default'
              );
              stats.updatedGoogle++;
              console.log('🔄 Updated Google task from local:', localTask.googleTaskId);
            }
          }
        } else if (!localTask.isArchived) {
          // Create new Google task
          const createdTask = await googleTasksIntegration.createTask(
            settings.userEmail || '', 
            localTask, 
            settings.defaultTaskListId || '@default'
          );
          
          // Update local task with Google ID
          await googleTasksService.syncTaskToGoogleTasks(settings.userEmail || '', localTask.id, {
            googleTaskId: createdTask.id || undefined,
            syncStatus: 'synced',
            lastSync: Date.now(),
            googleTaskUrl: createdTask.selfLink || undefined
          });
          
          stats.createdGoogle++;
          console.log('➕ Created Google task from local:', createdTask.id);
        }
      }
    }

    return stats;
  }

  /**
   * Process sync for category-based mode
   */
  private async processCategoryBasedSync(
    googleTasks: any[], 
    settings: GoogleTasksSettings, 
    stats: any
  ): Promise<any> {
    // Get local tasks from Firestore
    const localTasks = await taskService.getTasks(settings.userEmail || '');
    
    console.log('💾 Retrieved local tasks (category mode):', {
      count: localTasks.length,
      categories: [...new Set(localTasks.map((t: Task) => t.category))]
    });

    // Create lookup maps for efficiency
    const localTasksByGoogleId = new Map<string, Task>();
    localTasks.forEach((task: Task) => {
      if (task.googleTaskId) {
        localTasksByGoogleId.set(task.googleTaskId, task);
      }
    });

    // Sync from Google Tasks to local
    for (const googleTask of googleTasks) {
      stats.googleTasksProcessed++;
      
      console.log(`🔍 Processing Google Task: ${googleTask.title}`, {
        id: googleTask.id,
        status: googleTask.status,
        updated: googleTask.updated,
        deleted: googleTask.deleted,
        taskListId: googleTask._taskListId,
        taskListTitle: googleTask._taskListTitle
      });

      // Handle deleted Google tasks
      if (googleTask.deleted) {
        console.log('🗑️ Found deleted Google Task:', googleTask.id);
        const localTask = localTasksByGoogleId.get(googleTask.id);
        
        if (localTask) {
          console.log('🔧 Applying deleted task action:', settings.onDeletedTasksAction, 'to local task:', localTask.id);
          
          if (settings.onDeletedTasksAction === 'skip') {
            console.log('⏭️ Skipping deleted Google Task (user preference)');
          } else if (settings.onDeletedTasksAction === 'recreate') {
            // Recreate the task - handled by existing logic
            console.log('� Will recreate task in next sync cycle');
          }
        }
        continue;
      }

      // Find matching local task
      const localTask = localTasksByGoogleId.get(googleTask.id);

      if (localTask) {
        // Update existing local task if Google version is newer
        const googleUpdated = new Date(googleTask.updated || '');
        const localUpdated = localTask.updatedAt ? new Date(localTask.updatedAt) : new Date(0);

        if (googleUpdated > localUpdated) {
          const updates: any = {
            title: googleTask.title || '',
            description: googleTask.notes || '',
            updatedAt: googleUpdated.getTime()
          };

          if (googleTask.status === 'completed' && !localTask.completedAt) {
            updates.completedAt = googleUpdated.getTime();
          } else if (googleTask.status === 'needsAction' && localTask.completedAt) {
            updates.completedAt = null;
          }

          if (googleTask.due) {
            updates.scheduledAt = new Date(googleTask.due).getTime();
          }

          await taskService.updateTask(localTask.id, updates);
          stats.updatedLocal++;
          console.log('🔄 Updated local task from Google:', localTask.id);
        }
      } else {
        // Create new local task - infer category from task list
        let category = 'General';
        
        // Try to infer category from task list title
        if (googleTask._taskListTitle && settings.taskListPrefix) {
          const prefix = settings.taskListPrefix;
          if (googleTask._taskListTitle.startsWith(prefix)) {
            const extractedCategory = googleTask._taskListTitle.substring(prefix.length).trim();
            
            // Check if this is the archived task list
            if (extractedCategory.toLowerCase().includes('archived')) {
              category = 'General'; // Default for archived tasks
            } else {
              category = extractedCategory || 'General';
            }
          }
        }

        const newTask = {
          title: googleTask.title || '',
          description: googleTask.notes || '',
          category: category,
          priority: 'Medium' as const,
          duration: 60,
          rejectionCount: 0,
          isMuted: false,
          scheduledAt: googleTask.due ? new Date(googleTask.due).getTime() : undefined,
          completedAt: googleTask.status === 'completed' ? new Date(googleTask.updated || '').getTime() : undefined,
          isArchived: googleTask._taskListTitle?.toLowerCase().includes('archived') || false,
          googleTaskId: googleTask.id || null,
          createdAt: Date.now(),
          updatedAt: new Date(googleTask.updated || '').getTime()
        };

        await taskService.addTask(settings.userEmail || '', newTask as Omit<Task, "userEmail" | "id">);
        stats.createdLocal++;
        console.log('➕ Created local task from Google:', googleTask.id, 'with category:', category);
      }
    }

    // Sync from local to Google Tasks (if two-way sync is enabled)
    if (settings.syncDirection === 'bidirectional' || settings.syncDirection === 'app-to-google') {
      console.log('🔄 Starting two-way sync to Google Tasks (category mode)...');
      
      // Filter tasks: Only sync uncompleted tasks OR tasks that need to be archived
      const tasksToSync = localTasks.filter(task => {
        // Skip explicitly disabled tasks
        if (task.syncToGoogleTasks === false) {
          return false;
        }
        
        // Include uncompleted tasks (the main sync targets)
        if (!task.completedAt) {
          return true;
        }
        
        // Include tasks that are marked for archiving (isArchived: true)
        if (task.isArchived === true) {
          return true;
        }
        
        // Skip all other completed tasks
        console.log(`⏭️ Skipping completed task: ${task.title} (not marked for archiving)`);
        return false;
      });
      
      console.log(`📊 Filtered tasks for sync: ${tasksToSync.length} out of ${localTasks.length} total tasks`);
      
      for (const localTask of tasksToSync) {
        stats.localTasksSynced++;
        
        console.log(`🔍 Processing local task: ${localTask.title}`, {
          id: localTask.id,
          googleTaskId: localTask.googleTaskId,
          category: localTask.category,
          isCompleted: !!localTask.completedAt,
          isArchived: localTask.isArchived
        });

        // Determine the correct task list for this task
        const targetTaskListId = await this.getTaskListForTask(settings.userEmail || '', localTask, settings);
        
        if (localTask.googleTaskId) {
          // Update existing Google task
          const googleTask = googleTasks.find(t => t.id === localTask.googleTaskId);
          
          if (googleTask && !googleTask.deleted) {
            const localUpdated = localTask.updatedAt ? new Date(localTask.updatedAt) : new Date(0);
            const googleUpdated = new Date(googleTask.updated || '');

            if (localUpdated > googleUpdated) {
              // Check if task needs to be moved to a different task list
              if (googleTask._taskListId !== targetTaskListId) {
                console.log('📦 Moving task to different task list:', {
                  taskId: localTask.googleTaskId,
                  from: googleTask._taskListId,
                  to: targetTaskListId
                });
                
                // Delete from old task list and create in new one
                await googleTasksIntegration.deleteTask(settings.userEmail || '', googleTask._taskListId, localTask.googleTaskId);
                
                const createdTask = await googleTasksIntegration.createTask(
                  settings.userEmail || '', 
                  localTask, 
                  targetTaskListId
                );
                
                // Update local task with new Google ID
                await googleTasksService.syncTaskToGoogleTasks(settings.userEmail || '', localTask.id, {
                  googleTaskId: createdTask.id || undefined,
                  syncStatus: 'synced',
                  lastSync: Date.now(),
                  googleTaskUrl: createdTask.selfLink || undefined
                });
                
                stats.createdGoogle++;
                console.log('✅ Moved and updated Google task:', createdTask.id);
              } else {
                // Update in same task list
                await googleTasksIntegration.updateTask(
                  settings.userEmail || '', 
                  localTask.googleTaskId, 
                  localTask,
                  targetTaskListId
                );
                stats.updatedGoogle++;
                console.log('🔄 Updated Google task from local:', localTask.googleTaskId);
              }
            }
          }
        } else if (!localTask.isArchived) {
          // Create new Google task in appropriate task list
          const createdTask = await googleTasksIntegration.createTask(
            settings.userEmail || '', 
            localTask, 
            targetTaskListId
          );
          
          // Update local task with Google ID
          await googleTasksService.syncTaskToGoogleTasks(settings.userEmail || '', localTask.id, {
            googleTaskId: createdTask.id || undefined,
            syncStatus: 'synced',
            lastSync: Date.now(),
            googleTaskUrl: createdTask.selfLink || undefined
          });
          
          stats.createdGoogle++;
          console.log('➕ Created Google task in category list:', createdTask.id, 'list:', targetTaskListId);
        }
      }
    }

    return stats;
  }

  /**
   * Real-time sync method: Called when a task is created locally
   */
  async onTaskCreated(userEmail: string, task: Task): Promise<void> {
    try {
      const settings = await this.getVerifiedSettings(userEmail);
      if (!settings?.isConnected || !settings?.syncEnabled) {
        return; // Skip if sync is not enabled
      }

      if (settings.syncDirection !== 'app-to-google' && settings.syncDirection !== 'bidirectional') {
        return; // Skip if not syncing to Google
      }

      // Skip completed tasks - they should not be synced to Google Tasks
      if (task.completedAt) {
        this.log('info', 'Skipping completed task creation in Google Tasks', { 
          taskId: task.id, 
          title: task.title,
          completedAt: task.completedAt
        });
        return;
      }

      this.log('info', 'Real-time sync: Task created locally', { 
        taskId: task.id, 
        title: task.title,
        hasParent: !!task.parentId 
      });

      // Determine target task list
      const targetTaskListId = await this.getTaskListForTask(userEmail, task, settings);

      // Get parent Google task ID if this is a subtask
      let parentGoogleTaskId: string | undefined;
      if (task.parentId) {
        const parentTask = await taskService.getTask(task.parentId);
        parentGoogleTaskId = parentTask?.googleTaskId || undefined;
      }

      // Create Google task
      const createdTask = await googleTasksIntegration.createTask(
        userEmail, 
        task, 
        targetTaskListId,
        parentGoogleTaskId
      );

      // Update local task with Google ID
      if (createdTask.id) {
        await googleTasksService.syncTaskToGoogleTasks(userEmail, task.id, {
          googleTaskId: createdTask.id,
          syncStatus: 'synced',
          lastSync: Date.now(),
          googleTaskUrl: createdTask.selfLink || undefined,
          taskListId: targetTaskListId
        });

        this.log('success', 'Real-time sync: Created Google task', { 
          googleTaskId: createdTask.id,
          taskListId: targetTaskListId 
        });
      }
    } catch (error) {
      this.log('error', 'Real-time sync failed on task creation', error);
      // Don't throw - allow local task creation to succeed
    }
  }

  /**
   * Real-time sync method: Called when a task is updated locally
   */
  async onTaskUpdated(userEmail: string, task: Task, previousTask?: Task): Promise<void> {
    try {
      const settings = await this.getVerifiedSettings(userEmail);
      if (!settings?.isConnected || !settings?.syncEnabled) {
        return; // Skip if sync is not enabled
      }

      if (settings.syncDirection !== 'app-to-google' && settings.syncDirection !== 'bidirectional') {
        return; // Skip if not syncing to Google
      }

      this.log('info', 'Real-time sync: Task updated locally', { 
        taskId: task.id, 
        title: task.title,
        hasGoogleTaskId: !!task.googleTaskId,
        isCompleted: !!task.completedAt
      });

      // If task is completed, remove it from Google Tasks
      if (task.completedAt && task.googleTaskId) {
        try {
          const targetTaskListId = await this.getTaskListForTask(userEmail, task, settings);
          await googleTasksIntegration.deleteTask(userEmail, targetTaskListId, task.googleTaskId);
          
          // Clear the Google Task ID from the local task
          await googleTasksService.syncTaskToGoogleTasks(userEmail, task.id, {
            googleTaskId: undefined,
            syncStatus: 'deleted',
            lastSync: Date.now(),
            googleTaskUrl: undefined
          });

          this.log('success', 'Removed completed task from Google Tasks during update', {
            taskId: task.id,
            googleTaskId: task.googleTaskId
          });
        } catch (error) {
          this.log('warn', 'Failed to remove completed task from Google Tasks during update', {
            taskId: task.id,
            googleTaskId: task.googleTaskId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
        return;
      }

      // If task is not completed but doesn't have Google ID, create it
      if (!task.completedAt && !task.googleTaskId) {
        await this.onTaskCreated(userEmail, task);
        return;
      }

      // Skip if task is completed (nothing to update in Google Tasks)
      if (task.completedAt) {
        return;
      }

      // Check if task needs to be moved to a different task list (category-based mode)
      if (settings.syncMode === 'category-based' && previousTask && task.googleTaskId) {
        const previousTargetList = await this.getTaskListForTask(userEmail, previousTask, settings);
        const currentTargetList = await this.getTaskListForTask(userEmail, task, settings);

        if (previousTargetList !== currentTargetList) {
          this.log('info', 'Moving task between lists during update', {
            taskId: task.googleTaskId,
            from: previousTargetList,
            to: currentTargetList
          });

          // Delete from old list and create in new one
          await googleTasksIntegration.deleteTask(userEmail, previousTargetList, task.googleTaskId);
          
          const createdTask = await googleTasksIntegration.createTask(
            userEmail, 
            task, 
            currentTargetList
          );

          // Update local task with new Google ID
          if (createdTask.id) {
            await googleTasksService.syncTaskToGoogleTasks(userEmail, task.id, {
              googleTaskId: createdTask.id,
              syncStatus: 'synced',
              lastSync: Date.now(),
              googleTaskUrl: createdTask.selfLink || undefined
            });

            console.log('✅ Real-time sync: Moved and updated Google task:', createdTask.id);
          }
          return;
        }
      }

      // Update existing Google task if it has a Google Task ID
      if (task.googleTaskId) {
        const targetTaskListId = await this.getTaskListForTask(userEmail, task, settings);
        
        await googleTasksIntegration.updateTask(
          userEmail, 
          task.googleTaskId, 
          task,
          targetTaskListId
        );

        this.log('success', 'Updated Google task', { 
          taskId: task.id,
          googleTaskId: task.googleTaskId 
        });
      }

    } catch (error) {
      this.log('error', 'Real-time sync failed on task update', {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error)
      });
      // Don't throw - allow local task update to succeed
    }
  }

  /**
   * Real-time sync method: Called when a task is completed/uncompleted locally
   */
  async onTaskCompleted(userEmail: string, task: Task, isCompleted: boolean): Promise<void> {
    try {
      const settings = await googleTasksService.getGoogleTasksSettings(userEmail);
      if (!settings?.isConnected || !settings?.syncEnabled) {
        return; // Skip if sync is not enabled
      }

      if (settings.syncDirection !== 'app-to-google' && settings.syncDirection !== 'bidirectional') {
        return; // Skip if not syncing to Google
      }

      this.log('info', `Real-time sync: Task completion changed - ${task.title}`, {
        taskId: task.id,
        isCompleted,
        hasGoogleTaskId: !!task.googleTaskId
      });

      // If task is being completed, remove it from Google Tasks (since we don't sync completed tasks)
      if (isCompleted && task.googleTaskId) {
        try {
          // Find the task list where this task exists and delete it
          const targetTaskListId = await this.getTaskListForTask(userEmail, task, settings);
          await googleTasksIntegration.deleteTask(userEmail, targetTaskListId, task.googleTaskId);
          
          // Clear the Google Task ID from the local task
          await googleTasksService.syncTaskToGoogleTasks(userEmail, task.id, {
            googleTaskId: undefined,
            syncStatus: 'deleted',
            lastSync: Date.now(),
            googleTaskUrl: undefined
          });

          this.log('success', 'Removed completed task from Google Tasks', {
            taskId: task.id,
            googleTaskId: task.googleTaskId
          });
        } catch (error) {
          this.log('warn', 'Failed to remove completed task from Google Tasks', {
            taskId: task.id,
            googleTaskId: task.googleTaskId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
        return;
      }

      // If task is being uncompleted and doesn't have a Google Task ID, create it
      if (!isCompleted && !task.googleTaskId) {
        await this.onTaskCreated(userEmail, task);
        return;
      }

      // If task is being uncompleted and has a Google Task ID, verify it exists and update it
      if (!isCompleted && task.googleTaskId) {
        try {
          const targetTaskListId = await this.getTaskListForTask(userEmail, task, settings);
          
          // Verify the Google Task still exists
          const googleTaskExists = await this.verifyGoogleTaskExists(userEmail, targetTaskListId, task.googleTaskId);
          
          if (googleTaskExists) {
            // Update the existing Google Task
            await googleTasksIntegration.updateTask(userEmail, task.googleTaskId, task, targetTaskListId);
            this.log('success', 'Updated uncompleted task in Google Tasks', {
              taskId: task.id,
              googleTaskId: task.googleTaskId
            });
          } else {
            // Google Task doesn't exist, create a new one
            await this.onTaskCreated(userEmail, task);
          }
        } catch (error) {
          this.log('warn', 'Failed to update uncompleted task in Google Tasks', {
            taskId: task.id,
            googleTaskId: task.googleTaskId,
            error: error instanceof Error ? error.message : String(error)
          });
          // Don't throw - let local operations continue
        }
      }

    } catch (error) {
      console.error('❌ Real-time sync failed on task completion:', error);
      // Don't throw - allow local task completion to succeed
    }
  }

  /**
   * Real-time sync method: Called when a task is deleted locally
   */
  async onTaskDeleted(userEmail: string, task: Task): Promise<void> {
    try {
      const settings = await googleTasksService.getGoogleTasksSettings(userEmail);
      if (!settings?.isConnected || !settings?.syncEnabled) {
        return; // Skip if sync is not enabled
      }

      if (settings.syncDirection !== 'app-to-google' && settings.syncDirection !== 'bidirectional') {
        return; // Skip if not syncing to Google
      }

      console.log('🔄 Real-time sync: Task deleted locally:', task.id, task.title);

      if (!task.googleTaskId) {
        return; // Nothing to delete in Google Tasks
      }

      // Determine which task list the task was in
      const targetTaskListId = await this.getTaskListForTask(userEmail, task, settings);

      // Delete from Google Tasks
      await googleTasksIntegration.deleteTask(userEmail, targetTaskListId, task.googleTaskId);

      console.log('✅ Real-time sync: Deleted Google task:', task.googleTaskId);

    } catch (error) {
      console.error('❌ Real-time sync failed on task deletion:', error);
      // Don't throw - allow local task deletion to succeed
    }
  }

  /**
   * Clean up invalid task list references from user settings
   */
  private async cleanupInvalidTaskListReferences(
    userEmail: string, 
    invalidTaskLists: string[], 
    settings: GoogleTasksSettings
  ): Promise<void> {
    try {
      const updates: Partial<GoogleTasksSettings> = {};
      let hasChanges = false;

      // Clean up defaultTaskListId if it's invalid
      if (settings.defaultTaskListId && invalidTaskLists.includes(settings.defaultTaskListId)) {
        console.log(`🧹 Clearing invalid defaultTaskListId: ${settings.defaultTaskListId}`);
        updates.defaultTaskListId = '@default';
        hasChanges = true;
      }

      // Clean up archivedTaskListId if it's invalid
      if (settings.archivedTaskListId && invalidTaskLists.includes(settings.archivedTaskListId)) {
        console.log(`🧹 Clearing invalid archivedTaskListId: ${settings.archivedTaskListId}`);
        updates.archivedTaskListId = undefined;
        hasChanges = true;
      }

      // Clean up categoryTaskLists if any are invalid
      if (settings.categoryTaskLists) {
        const cleanCategoryTaskLists = { ...settings.categoryTaskLists };
        
        for (const [category, taskListId] of Object.entries(cleanCategoryTaskLists)) {
          if (invalidTaskLists.includes(taskListId)) {
            console.log(`🧹 Removing invalid category task list: ${category} -> ${taskListId}`);
            delete cleanCategoryTaskLists[category];
            hasChanges = true;
          }
        }
        
        if (hasChanges) {
          updates.categoryTaskLists = cleanCategoryTaskLists;
        }
      }

      // Apply updates if there are any changes
      if (hasChanges) {
        await googleTasksService.updateGoogleTasksSettings(userEmail, updates);
        console.log('✅ Cleaned up invalid task list references from settings');
      }
    } catch (error) {
      console.error('❌ Failed to clean up invalid task list references:', error);
    }
  }
}

export const googleTasksSyncService = new GoogleTasksSyncService();
