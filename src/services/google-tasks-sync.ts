import type { Task, GoogleTasksSettings } from '@/lib/types';
import { googleTasksIntegration } from './google-tasks';
import { googleTasksService, taskService } from '@/lib/firestore';
import { tasks_v1 } from 'googleapis';

interface SyncConflict {
  appTask: Task;
  googleTask: tasks_v1.Schema$Task;
  conflictType: 'both_modified' | 'deleted_in_app' | 'deleted_in_google';
}

class GoogleTasksSyncService {
  /**
   * Perform full two-way sync for a user
   */
  async syncUserTasks(userEmail: string): Promise<{
    success: boolean;
    synced: number;
    conflicts: SyncConflict[];
    errors: string[];
  }> {
    try {
      const settings = await googleTasksService.getGoogleTasksSettings(userEmail);
      if (!settings || !settings.isConnected || !settings.syncEnabled) {
        return { success: false, synced: 0, conflicts: [], errors: ['Google Tasks not connected or sync disabled'] };
      }

      await googleTasksService.updateGoogleTasksSettings(userEmail, {
        syncStatus: 'syncing'
      });

      const result = await this.performSync(userEmail, settings);

      await googleTasksService.updateGoogleTasksSettings(userEmail, {
        syncStatus: result.success ? 'success' : 'error',
        lastSyncAt: Date.now(),
        lastError: result.errors.length > 0 ? result.errors.join('; ') : undefined
      });

      return result;
    } catch (error) {
      console.error('Error during sync:', error);
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
   * Perform the actual synchronization logic
   */
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
                  await googleTasksIntegration.updateTask(userEmail, appTask.googleTaskId, appTask, settings.defaultTaskListId);
                  await googleTasksService.syncTaskToGoogleTasks(userEmail, appTask.id, {
                    syncStatus: 'synced',
                    lastSync: Date.now()
                  });
                  synced++;
                }
              } else {
                // Google task was deleted - handle based on user preference
                const onDeletedAction = settings.onDeletedTasksAction || 'skip';
                console.log(`🗑️ Google task ${appTask.googleTaskId} was deleted`);
                console.log(`🔍 DEBUG - settings.onDeletedTasksAction raw value:`, settings.onDeletedTasksAction);
                console.log(`🔍 DEBUG - onDeletedAction final value:`, onDeletedAction);
                console.log(`🔍 DEBUG - full settings object:`, JSON.stringify(settings, null, 2));
                
                if (onDeletedAction === 'recreate') {
                  console.log(`🔄 Recreating deleted Google task for app task ${appTask.id}: ${appTask.title}`);
                  // Recreate the Google task
                  try {
                    // Get parent Google task ID if this is a subtask
                    let parentGoogleTaskId: string | undefined;
                    if (appTask.parentId) {
                      const parentAppTask = appTasks.find(t => t.id === appTask.parentId);
                      parentGoogleTaskId = parentAppTask?.googleTaskId || undefined;
                    }

                    const recreatedTask = await googleTasksIntegration.createTask(
                      userEmail, 
                      appTask, 
                      settings.defaultTaskListId,
                      parentGoogleTaskId
                    );
                    
                    if (recreatedTask.id) {
                      await googleTasksService.syncTaskToGoogleTasks(userEmail, appTask.id, {
                        googleTaskId: recreatedTask.id,
                        syncStatus: 'synced',
                        lastSync: Date.now(),
                        googleTaskUrl: recreatedTask.selfLink || undefined
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
   * Push a single task change to Google Tasks
   */
  async pushTaskChange(userEmail: string, taskId: string): Promise<void> {
    try {
      console.log(`🔄 pushTaskChange: Starting sync for task ${taskId}`);

      const task = await taskService.getTask(taskId);
      if (!task) {
        console.log(`❌ pushTaskChange: Task not found: ${taskId}`);
        return;
      }

      console.log(`📋 pushTaskChange: Task data retrieved:`, {
        id: task.id,
        title: task.title,
        syncToGoogleTasks: task.syncToGoogleTasks,
        hasGoogleTaskId: !!task.googleTaskId,
        parentId: task.parentId,
        completedAt: task.completedAt,
        googleTaskSyncStatus: task.googleTaskSyncStatus
      });

      if (!task.syncToGoogleTasks) {
        console.log(`⏭️ pushTaskChange: Skipping sync - syncToGoogleTasks is false for task: ${taskId}`);
        return;
      }

      const settings = await googleTasksService.getGoogleTasksSettings(userEmail);
      console.log(`⚙️ pushTaskChange: Google Tasks settings retrieved:`, {
        isConnected: settings?.isConnected,
        syncEnabled: settings?.syncEnabled,
        hasAccessToken: !!settings?.accessToken,
        hasRefreshToken: !!settings?.refreshToken,
        defaultTaskListId: settings?.defaultTaskListId
      });

      if (!settings) {
        console.log(`❌ pushTaskChange: No Google Tasks settings found for user: ${userEmail}`);
        return;
      }

      if (!settings.isConnected) {
        console.log(`❌ pushTaskChange: Google Tasks not connected for user: ${userEmail}`);
        return;
      }

      if (!settings.syncEnabled) {
        console.log(`❌ pushTaskChange: Google Tasks sync disabled for user: ${userEmail}`);
        return;
      }

      console.log(`📝 pushTaskChange: Task details:`, {
        id: task.id,
        title: task.title,
        hasGoogleTaskId: !!task.googleTaskId,
        parentId: task.parentId,
        completedAt: task.completedAt,
        syncStatus: task.googleTaskSyncStatus,
        isBeingUncompleted: task.completedAt === null || task.completedAt === undefined
      });

      // For subtasks, we need to find the parent's Google Task ID
      let parentGoogleTaskId: string | undefined;
      if (task.parentId) {
        const parentTask = await taskService.getTask(task.parentId);
        if (parentTask?.googleTaskId) {
          parentGoogleTaskId = parentTask.googleTaskId;
          console.log(`🔗 Found parent Google task ID: ${parentGoogleTaskId}`);
        } else {
          console.log(`⚠️ Parent task ${task.parentId} has no Google task ID - syncing parent first`);
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
        console.log(`🔧 Updating existing Google task: ${task.googleTaskId}`);
        // Update existing Google task
        await googleTasksIntegration.updateTask(userEmail, task.googleTaskId, task, settings.defaultTaskListId, parentGoogleTaskId);
        
        await googleTasksService.syncTaskToGoogleTasks(userEmail, task.id, {
          syncStatus: 'synced',
          lastSync: Date.now()
        });
        console.log(`✅ Updated existing Google task: ${task.googleTaskId}`);
      } else {
        console.log(`🆕 Creating new Google task for: ${task.title}${task.parentId ? ' (subtask)' : ''}`);
        
        // Before creating, check if a similar task already exists in Google Tasks
        const existingGoogleTasks = await googleTasksIntegration.getTasks(userEmail, settings.defaultTaskListId);
        const duplicateTask = existingGoogleTasks.find(gTask => 
          gTask.title === task.title && 
          gTask.notes === task.description &&
          Math.abs((gTask.due ? new Date(gTask.due).getTime() : 0) - (task.reminderAt || 0)) < 24 * 60 * 60 * 1000 && // Within 24 hours
          gTask.parent === parentGoogleTaskId // Same parent relationship
        );

        if (duplicateTask) {
          console.log(`🔗 Found existing Google task, linking instead of creating duplicate: ${duplicateTask.id}`);
          // Link to existing task instead of creating duplicate
          await googleTasksService.syncTaskToGoogleTasks(userEmail, task.id, {
            googleTaskId: duplicateTask.id!,
            syncStatus: 'synced',
            lastSync: Date.now(),
            googleTaskUrl: duplicateTask.selfLink || undefined
          });
        } else {
          // Create new Google task (with proper parent relationship)
          const createdTask = await googleTasksIntegration.createTask(userEmail, task, settings.defaultTaskListId, parentGoogleTaskId);
          if (createdTask.id) {
            await googleTasksService.syncTaskToGoogleTasks(userEmail, task.id, {
              googleTaskId: createdTask.id,
              syncStatus: 'synced',
              lastSync: Date.now(),
              googleTaskUrl: createdTask.selfLink || undefined
            });
            console.log(`✅ Created new Google task: ${createdTask.id}${task.parentId ? ' (subtask)' : ''}`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error pushing task change:', error);
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
      console.log(`🔄 Starting bulk sync of incomplete tasks for ${userEmail}`);

      const settings = await googleTasksService.getGoogleTasksSettings(userEmail);
      if (!settings || !settings.isConnected || !settings.syncEnabled) {
        throw new Error('Google Tasks not connected or sync disabled');
      }

      // Get all incomplete tasks
      const allTasks = await taskService.getTasks(userEmail);
      const incompleteTasks = allTasks.filter(task => 
        !task.completedAt && // Not completed
        task.syncToGoogleTasks !== false // Sync enabled (true or undefined)
      );

      console.log(`📊 Found ${incompleteTasks.length} incomplete tasks to potentially sync`);

      let syncedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      // Sort tasks so parent tasks are synced before their subtasks
      const sortedTasks = this.sortTasksByParentChild(incompleteTasks);

      for (const task of sortedTasks) {
        try {
          // Skip if already synced
          if (task.googleTaskId) {
            console.log(`⏭️ Skipping already synced task: ${task.title}`);
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
          console.log(`✅ Synced task: ${task.title}`);

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          const errorMsg = `Failed to sync task "${task.title}": ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

      console.log(`🎉 Bulk sync completed. Synced: ${syncedCount}, Skipped: ${skippedCount}, Errors: ${errors.length}`);

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
}

export const googleTasksSyncService = new GoogleTasksSyncService();
