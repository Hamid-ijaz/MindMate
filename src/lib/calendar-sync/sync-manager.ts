// Calendar Sync Manager - Orchestrates sync across multiple providers
import { GoogleCalendarService } from '@/lib/calendar-sync/google-calendar';
import { OutlookCalendarService } from '@/lib/calendar-sync/outlook-calendar';
import type { 
  ExternalCalendar, 
  SyncableCalendarEvent, 
  CalendarSyncConfig,
  CalendarProvider,
  SyncConflict,
  SyncStatus,
  Task 
} from '@/lib/types';

export interface SyncResult {
  success: boolean;
  calendarId: string;
  provider: string;
  stats: {
    added: number;
    updated: number;
    deleted: number;
    conflicts: number;
  };
  errors: string[];
  duration: number;
}

export class CalendarSyncManager {
  private googleService: GoogleCalendarService | null = null;
  private outlookService: OutlookCalendarService | null = null;
  private syncInProgress = new Set<string>();
  private conflictQueue: SyncConflict[] = [];

  constructor(private config: CalendarSyncConfig) {}

  /**
   * Initialize calendar services
   */
  async initialize() {
    // Initialize Google Calendar service
    if (this.config.enabledProviders.includes('google')) {
      this.googleService = new GoogleCalendarService(
        process.env.GOOGLE_CLIENT_ID!,
        process.env.GOOGLE_CLIENT_SECRET!,
        process.env.GOOGLE_REDIRECT_URI!
      );
    }

    // Initialize Outlook service
    if (this.config.enabledProviders.includes('outlook')) {
      this.outlookService = new OutlookCalendarService(
        process.env.OUTLOOK_CLIENT_ID!,
        process.env.OUTLOOK_CLIENT_SECRET!,
        process.env.OUTLOOK_REDIRECT_URI!
      );
    }
  }

  /**
   * Sync all enabled calendars
   */
  async syncAllCalendars(
    externalCalendars: ExternalCalendar[],
    localTasks: Task[]
  ): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    const enabledCalendars = externalCalendars.filter(cal => cal.isEnabled);

    for (const calendar of enabledCalendars) {
      if (this.syncInProgress.has(calendar.id)) {
        console.log(`Sync already in progress for calendar ${calendar.id}`);
        continue;
      }

      try {
        const result = await this.syncCalendar(calendar, localTasks);
        results.push(result);
      } catch (error) {
        console.error(`Failed to sync calendar ${calendar.id}:`, error);
        results.push({
          success: false,
          calendarId: calendar.id,
          provider: calendar.provider,
          stats: { added: 0, updated: 0, deleted: 0, conflicts: 0 },
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          duration: 0,
        });
      }
    }

    return results;
  }

  /**
   * Sync a specific calendar
   */
  async syncCalendar(
    calendar: ExternalCalendar,
    localTasks: Task[]
  ): Promise<SyncResult> {
    const startTime = Date.now();
    this.syncInProgress.add(calendar.id);

    try {
      const result: SyncResult = {
        success: false,
        calendarId: calendar.id,
        provider: calendar.provider,
        stats: { added: 0, updated: 0, deleted: 0, conflicts: 0 },
        errors: [],
        duration: 0,
      };

      // Filter tasks for this calendar's categories
      const relevantTasks = localTasks.filter(task => 
        this.config.syncCategories.length === 0 || 
        this.config.syncCategories.includes(task.category)
      );

      switch (calendar.provider) {
        case 'google':
          await this.syncGoogleCalendar(calendar, relevantTasks, result);
          break;
        case 'outlook':
          await this.syncOutlookCalendar(calendar, relevantTasks, result);
          break;
        default:
          result.errors.push(`Unsupported provider: ${calendar.provider}`);
          return result;
      }

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

      return result;
    } finally {
      this.syncInProgress.delete(calendar.id);
    }
  }

  /**
   * Sync Google Calendar
   */
  private async syncGoogleCalendar(
    calendar: ExternalCalendar,
    localTasks: Task[],
    result: SyncResult
  ): Promise<void> {
    if (!this.googleService) {
      result.errors.push('Google Calendar service not initialized');
      return;
    }

    try {
      // Set tokens for this calendar
      this.googleService.setTokens(
        calendar.accessToken!,
        calendar.refreshToken,
        calendar.tokenExpiresAt
      );

      // Perform sync
      const syncResult = await this.googleService.syncEvents(
        calendar.calendarId || 'primary',
        localTasks,
        calendar.syncToken
      );

      result.stats.added = syncResult.added.length;
      result.stats.updated = syncResult.updated.length;
      result.stats.deleted = syncResult.deleted.length;
      result.stats.conflicts = syncResult.conflicts.length;

      // Update calendar sync token
      calendar.syncToken = syncResult.nextSyncToken;
      calendar.lastSyncAt = Date.now();
      calendar.syncStatus = 'success';

      // Process conflicts
      for (const conflict of syncResult.conflicts) {
        this.conflictQueue.push({
          id: `${calendar.id}-${conflict.taskId}`,
          taskId: conflict.taskId,
          calendarId: calendar.id,
          localVersion: conflict.localVersion,
          externalVersion: conflict.externalVersion,
          conflictFields: conflict.conflictFields,
          suggestedResolution: this.suggestConflictResolution(conflict),
        });
      }

    } catch (error) {
      calendar.syncStatus = 'error';
      calendar.lastError = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(calendar.lastError);
    }
  }

  /**
   * Sync Outlook Calendar
   */
  private async syncOutlookCalendar(
    calendar: ExternalCalendar,
    localTasks: Task[],
    result: SyncResult
  ): Promise<void> {
    if (!this.outlookService) {
      result.errors.push('Outlook Calendar service not initialized');
      return;
    }

    // Implementation similar to Google Calendar sync
    // This would use the OutlookCalendarService methods
    result.errors.push('Outlook sync not implemented yet');
  }

  /**
   * Suggest conflict resolution strategy
   */
  private suggestConflictResolution(conflict: any): 'local' | 'external' | 'merge' {
    switch (this.config.conflictResolution) {
      case 'local-wins':
        return 'local';
      case 'external-wins':
        return 'external';
      case 'newest-wins':
        return conflict.localVersion.updatedAt > conflict.externalVersion.updated ? 'local' : 'external';
      case 'manual':
      default:
        return 'merge'; // Let user decide
    }
  }

  /**
   * Resolve a specific conflict
   */
  async resolveConflict(
    conflictId: string,
    resolution: 'local' | 'external' | 'merge',
    mergedData?: Partial<Task>
  ): Promise<void> {
    const conflictIndex = this.conflictQueue.findIndex(c => c.id === conflictId);
    if (conflictIndex === -1) {
      throw new Error('Conflict not found');
    }

    const conflict = this.conflictQueue[conflictIndex];
    
    try {
      switch (resolution) {
        case 'local':
          // Update external calendar with local version
          await this.updateExternalEvent(conflict.calendarId, conflict.localVersion);
          break;
        case 'external':
          // Update local task with external version
          await this.updateLocalTask(conflict.taskId, conflict.externalVersion);
          break;
        case 'merge':
          if (mergedData && mergedData.id) {
            // Update both with merged data
            await this.updateLocalTask(conflict.taskId, mergedData);
            await this.updateExternalEvent(conflict.calendarId, mergedData as Task);
          }
          break;
      }

      // Remove resolved conflict
      this.conflictQueue.splice(conflictIndex, 1);
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      throw error;
    }
  }

  /**
   * Get pending conflicts
   */
  getPendingConflicts(): SyncConflict[] {
    return [...this.conflictQueue];
  }

  /**
   * Update external calendar event
   */
  private async updateExternalEvent(calendarId: string, task: Task): Promise<void> {
    // Find the calendar and update the event using appropriate service
    // Implementation depends on the calendar provider
  }

  /**
   * Update local task
   */
  private async updateLocalTask(taskId: string, data: any): Promise<void> {
    // This would typically call the task service to update the local task
    // Implementation depends on your task storage system
  }

  /**
   * Get sync statistics
   */
  getSyncStats(calendarId?: string): {
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    lastSyncTime?: number;
    averageSyncDuration: number;
  } {
    // Implementation would track sync statistics
    return {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      averageSyncDuration: 0,
    };
  }

  /**
   * Schedule automatic sync
   */
  scheduleAutoSync(calendars: ExternalCalendar[], tasks: Task[]): void {
    if (!this.config.autoSync) return;

    const interval = this.config.syncInterval * 60 * 1000; // Convert minutes to milliseconds
    
    setInterval(async () => {
      try {
        console.log('Running scheduled sync...');
        await this.syncAllCalendars(calendars, tasks);
      } catch (error) {
        console.error('Scheduled sync failed:', error);
      }
    }, interval);
  }

  /**
   * Test calendar connection
   */
  async testConnection(calendar: ExternalCalendar): Promise<boolean> {
    try {
      switch (calendar.provider) {
        case 'google':
          if (!this.googleService) return false;
          this.googleService.setTokens(
            calendar.accessToken!,
            calendar.refreshToken,
            calendar.tokenExpiresAt
          );
          await this.googleService.getCalendarList();
          return true;
        case 'outlook':
          if (!this.outlookService) return false;
          // Test Outlook connection
          return true;
        default:
          return false;
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get current conflicts
   */
  getConflicts(): SyncConflict[] {
    return [...this.conflictQueue];
  }

  /**
   * Get sync status for all calendars
   */
  async getSyncStatus(): Promise<{
    isActive: boolean;
    lastSync?: number;
    nextSync?: number;
    conflicts: number;
    errors: string[];
  }> {
    return {
      isActive: this.syncInProgress.size > 0,
      conflicts: this.conflictQueue.length,
      errors: [],
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.syncInProgress.clear();
    this.conflictQueue.length = 0;
  }
}
