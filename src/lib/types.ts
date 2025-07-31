
import { z } from "zod";

// These are now dynamic, but we define the type.
export type TaskCategory = string; 
export const taskCategories: [TaskCategory, ...TaskCategory[]] = ['Work', 'Chores', 'Writing', 'Personal', 'Study']; // Default values

export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';
export const priorities: [Priority, ...Priority[]] = ['Low', 'Medium', 'High', 'Critical'];

export type TaskDuration = number;
export const taskDurations: [TaskDuration, ...TaskDuration[]] = [15, 30, 60, 90]; // Default values

export type TimeOfDay = 'Morning' | 'Afternoon' | 'Evening';
export const timesOfDay: [TimeOfDay, ...TimeOfDay[]] = ['Morning', 'Afternoon', 'Evening'];

export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly';
export const recurrenceFrequencies: RecurrenceFrequency[] = ['none', 'daily', 'weekly', 'monthly'];

// Calendar and Time Management Types
export type CalendarView = 'day' | 'week' | 'month' | 'agenda';
export const calendarViews: CalendarView[] = ['day', 'week', 'month', 'agenda'];

export type PomodoroStatus = 'idle' | 'active' | 'break' | 'long-break' | 'paused';

export interface PomodoroSession {
  id: string;
  taskId: string;
  startTime: number;
  endTime?: number;
  duration: number; // in minutes, typically 25
  type: 'work' | 'short-break' | 'long-break';
  completed: boolean;
  interrupted: boolean;
  notes?: string;
}

export interface CalendarEvent {
  id: string;
  taskId?: string; // Link to task if this event is for a task
  title: string;
  description?: string;
  start: number; // timestamp
  end: number; // timestamp
  isAllDay: boolean;
  location?: string;
  attendees?: string[];
  color?: string;
  recurrence?: RecurrencePattern;
  externalCalendarId?: string; // For external calendar sync
  externalEventId?: string;
}

export interface RecurrencePattern {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // every N days/weeks/months
  daysOfWeek?: number[]; // 0-6, Sunday = 0
  endDate?: number;
  count?: number; // number of occurrences
}

export interface TimeBlock {
  id: string;
  start: number;
  end: number;
  taskId?: string;
  title: string;
  color?: string;
  isLocked?: boolean; // prevent accidental changes
  type: 'task' | 'break' | 'meeting' | 'focus-time';
}

export interface CalendarSettings {
  defaultView: CalendarView;
  workingHours: {
    start: string; // "09:00"
    end: string;   // "17:00"
    days: number[]; // [1,2,3,4,5] for Mon-Fri
  };
  timeZone: string;
  weekStartsOn: number; // 0 = Sunday, 1 = Monday
  showWeekends: boolean;
  defaultEventDuration: number; // in minutes
  pomodoroSettings: {
    workDuration: number; // 25 minutes
    shortBreakDuration: number; // 5 minutes
    longBreakDuration: number; // 15 minutes
    sessionsUntilLongBreak: number; // 4
    autoStartBreaks: boolean;
    autoStartPomodoros: boolean;
    soundEnabled: boolean;
    soundVolume: number; // 0-100
  };
  externalCalendars: ExternalCalendar[];
}

export interface ExternalCalendar {
  id: string;
  name: string;
  provider: CalendarProvider;
  email?: string;
  color: string;
  isEnabled: boolean;
  syncDirection: 'read-only' | 'two-way';
  lastSyncAt?: number;
  syncToken?: string; // for incremental sync
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  calendarId?: string; // External calendar ID
  syncStatus: SyncStatus;
  lastError?: string;
  syncStats: {
    totalEvents: number;
    lastSyncDuration: number;
    eventsAdded: number;
    eventsUpdated: number;
    eventsDeleted: number;
  };
}

// Calendar Provider Types
export type CalendarProvider = 'google' | 'outlook' | 'apple' | 'caldav';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success' | 'pending' | 'synced' | 'conflict';

export interface SyncConflict {
  id: string;
  taskId: string;
  calendarId: string;
  localVersion: Task;
  externalVersion: any;
  conflictFields: string[];
  suggestedResolution: 'local' | 'external' | 'merge';
}

// Enhanced Calendar Event for external sync
export interface SyncableCalendarEvent extends CalendarEvent {
  externalId?: string; // ID from external calendar
  lastModified?: number;
  syncStatus: 'local' | 'synced' | 'conflict' | 'error';
  conflictData?: {
    localVersion: CalendarEvent;
    externalVersion: any;
    conflictFields: string[];
  };
}

// Calendar sync configuration
export interface CalendarSyncConfig {
  autoSync: boolean;
  syncInterval: number; // minutes
  conflictResolution: 'manual' | 'local-wins' | 'external-wins' | 'newest-wins';
  enabledProviders: ('google' | 'outlook' | 'apple')[];
  syncCategories: string[]; // which task categories to sync
  defaultCalendarId?: string; // default external calendar for new events
  syncDirection: 'read-only' | 'write-only' | 'two-way';
  includeCompletedTasks: boolean;
  calendarMapping: { [localCategory: string]: string }; // map local categories to external calendar IDs
}

// Advanced recurrence patterns
export interface AdvancedRecurrencePattern extends RecurrencePattern {
  byWeekDay?: number[]; // 0-6, Sunday = 0, with optional week number
  byMonthDay?: number[]; // 1-31
  byYearDay?: number[]; // 1-366
  byWeek?: number[]; // 1-53
  byMonth?: number[]; // 1-12
  bySetPos?: number[]; // -366 to 366
  workdaysOnly?: boolean;
  timezone?: string;
  exceptions?: number[]; // timestamps of excluded dates
}

// Smart scheduling suggestions
export interface SchedulingSuggestion {
  id: string;
  taskId: string;
  suggestedStart: number;
  suggestedEnd: number;
  confidence: number; // 0-1
  reason: string;
  factors: {
    timePreference: number;
    workloadBalance: number;
    energyLevel: number;
    contextSwitching: number;
    deadlineUrgency: number;
  };
  alternatives: Array<{
    start: number;
    end: number;
    confidence: number;
    reason: string;
  }>;
}

// Calendar analytics
export interface CalendarAnalytics {
  userId: string;
  period: 'day' | 'week' | 'month' | 'year';
  startDate: number;
  endDate: number;
  metrics: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    totalTimeScheduled: number; // minutes
    totalTimeSpent: number; // minutes
    averageTaskDuration: number;
    productiveHours: number[];
    categoryDistribution: Record<string, number>;
    priorityDistribution: Record<string, number>;
    pomodoroSessions: number;
    focusTime: number; // minutes in deep work
    distractionTime: number; // minutes of interruptions
    schedulingAccuracy: number; // how often tasks finish on time
  };
  patterns: {
    mostProductiveDay: string;
    mostProductiveHour: number;
    leastProductiveHour: number;
    averageTasksPerDay: number;
    streakDays: number; // consecutive days with completed tasks
    burnoutRisk: number; // 0-1 scale
  };
  recommendations: string[];
}

export interface Task {
  id: string;
  userEmail: string;
  title: string;
  description?: string;
  category: TaskCategory;
  priority: Priority;
  duration: TaskDuration;
  timeOfDay: TimeOfDay;
  createdAt: number;
  rejectionCount: number;
  lastRejectedAt?: number;
  isMuted: boolean;
  completedAt?: number;
  parentId?: string;
  reminderAt?: number;
  notifiedAt?: number;
  recurrence?: {
    frequency: RecurrenceFrequency;
    endDate?: number;
  };
  // Enhanced Calendar & Time Management features
  scheduledAt?: number; // Specific date/time when task is scheduled
  scheduledEndAt?: number; // End time for time-blocked tasks
  isTimeBlocked?: boolean; // Whether this task has a specific time block
  calendarEventId?: string; // External calendar event ID for sync
  pomodoroSessions?: number; // Number of pomodoro sessions completed
  estimatedPomodoros?: number; // Estimated number of pomodoro sessions needed
  timeSpent?: number; // Actual time spent on task (in minutes)
  isAllDay?: boolean; // Whether this is an all-day task
  calendarColor?: string; // Color for calendar display
  location?: string; // Location for the task
  attendees?: string[]; // Email addresses of attendees
  isRecurring?: boolean; // Whether this task repeats
  originalTaskId?: string; // For recurring tasks, reference to original
}

export interface User {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dob?: string;
  password?: string; // In a real app, this would be a hash
}

export interface Accomplishment {
    id: string;
    date: string; // YYYY-MM-DD
    content: string;
}

export interface Note {
    id: string;
    userEmail: string;
    title: string;
    content: string; // Will store HTML content for rich text
    imageUrl?: string | null;
    audioUrl?: string | null;
    color?: string; // e.g., hex code for background color
    fontSize?: number; // New property for font size
    createdAt: number;
    updatedAt: number;
}

// Schema for the rewordTask AI flow
export const RewordTaskInputSchema = z.object({
  title: z.string().describe('The original title of the task.'),
  description: z.string().describe('The original description of the task.'),
});
export type RewordTaskInput = z.infer<typeof RewordTaskInputSchema>;

export const SuggestedTaskSchema = z.object({
    title: z.string().describe("The title of a smaller, actionable sub-task."),
    description: z.string().describe("A brief, encouraging description for the sub-task."),
});

export const RewordTaskOutputSchema = z.object({
  suggestedTasks: z.array(SuggestedTaskSchema).describe("A list of 2-4 smaller, concrete steps to break down the original task."),
});
export type RewordTaskOutput = z.infer<typeof RewordTaskOutputSchema>;

// Sharing and collaboration types
export type SharePermission = 'view' | 'edit';

export interface SharedItem {
  id: string;
  itemId: string; // The task or note ID
  itemType: 'task' | 'note';
  ownerEmail: string;
  ownerName?: string; // Display name of owner
  permission: SharePermission;
  shareToken: string; // Unique token for the share URL
  createdAt: number;
  updatedAt: number;
  expiresAt?: number; // Optional expiration
  isActive: boolean;
  viewCount: number; // Track how many times viewed
  lastViewedAt?: number; // Last time someone viewed
  lastEditedAt?: number; // Last time someone edited
  lastEditedBy?: string; // Email of last editor
  allowComments?: boolean; // Allow comments on shared item
  allowDownload?: boolean; // Allow downloading/duplicating
  history: ShareHistoryEntry[];
  collaborators: ShareCollaborator[]; // People with direct access
}

export interface ShareCollaborator {
  email: string;
  name?: string;
  permission: SharePermission;
  addedAt: number;
  addedBy: string; // Email of who added them
  lastAccessAt?: number;
}

export interface ShareHistoryEntry {
  id: string;
  userId?: string; // Email if logged in, 'anonymous' for guests
  userName?: string; // Display name if available
  userAvatar?: string; // Avatar URL if available
  action: string; // "viewed", "edited", "commented", "duplicated", etc.
  timestamp: number;
  fieldChanged?: string; // Which field was changed
  oldValue?: any; // Previous value
  newValue?: any; // New value
  details?: string; // Additional context
  ipAddress?: string; // For security tracking
  userAgent?: string; // Browser info
}

export interface ShareLinkInfo {
  url: string;
  permission: SharePermission;
  token: string;
  createdAt: number;
  isActive: boolean;
  viewCount: number;
  lastViewedAt?: number;
}

export interface ShareAnalytics {
  totalViews: number;
  uniqueViewers: number;
  totalEdits: number;
  uniqueEditors: number;
  averageViewTime?: number;
  mostActiveDay?: string;
  topActions: Array<{ action: string; count: number }>;
  recentActivity: ShareHistoryEntry[];
}

export interface ShareSettings {
  allowAnonymousViewing: boolean;
  allowAnonymousEditing: boolean;
  requireAuthentication: boolean;
  autoExpire: boolean;
  expirationDays: number;
  maxViewers?: number;
  maxEditors?: number;
  allowComments: boolean;
  allowDownload: boolean;
  trackAnalytics: boolean;
  notifyOnView: boolean;
  notifyOnEdit: boolean;
}
