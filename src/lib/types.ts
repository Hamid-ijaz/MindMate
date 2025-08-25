
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
  isArchived?: boolean;
  completedAt?: number;
  parentId?: string;
  reminderAt?: number;
  /**
   * If true, only send a single reminder at the exact `reminderAt` time and
   * skip overdue notifications for this task. Added to support "only notify at reminder" option.
   */
  onlyNotifyAtReminder?: boolean;
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
  // Google Calendar Integration
  syncToGoogleCalendar?: boolean; // Whether this task should sync to Google Calendar
  googleCalendarEventId?: string; // Google Calendar event ID
  googleCalendarSyncStatus?: 'pending' | 'synced' | 'error' | 'deleted';
  googleCalendarLastSync?: number; // Timestamp of last sync
  googleCalendarUrl?: string; // Direct link to Google Calendar event
  googleCalendarError?: string; // Error message if sync failed
}

export interface User {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dob?: string;
  password?: string; // In a real app, this would be a hash
  // Push Notification Settings
  notificationPreferences?: NotificationPreferences;
  // Google Calendar Integration Settings
  googleCalendarSettings?: GoogleCalendarSettings;
}

// Google Calendar Integration Types
export interface GoogleCalendarSettings {
  isConnected: boolean;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  userEmail?: string;
  defaultCalendarId?: string; // Which Google calendar to sync with
  syncEnabled: boolean; // Global sync toggle
  lastSyncAt?: number;
  connectedAt?: number; // When the calendar was first connected
  syncStatus?: 'idle' | 'syncing' | 'success' | 'error';
  lastError?: string;
}

// Push Notification Types
export interface NotificationPreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  reminderEnabled: boolean;
  overdueEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHours: {
    start: string; // "22:00"
    end: string;   // "08:00"
  };
  reminderTiming: {
    beforeMinutes: number; // 15, 30, 60, etc.
    smartTiming: boolean; // Use AI to optimize timing
  };
  notificationTypes: {
    taskReminders: boolean;
    overdueTasks: boolean;
    recurringTasks: boolean;
    collaborationUpdates: boolean;
    systemNotifications: boolean;
  };
  deliverySettings: {
    sound: boolean;
    vibration: boolean;
    priority: 'low' | 'normal' | 'high';
    groupSimilar: boolean; // Group similar notifications
    maxDaily: number; // Maximum notifications per day
  };
}

// Push Subscription Types for Firestore
export interface PushSubscriptionDocument {
  id?: string;
  userId: string; // Use userEmail for consistency
  userEmail: string; // Primary identifier for user
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  isActive: boolean;
  subscribedAt: number;
  lastUsedAt?: number;
  deviceInfo: {
    userAgent: string;
    platform: string;
    vendor: string;
    browserName?: string;
    browserVersion?: string;
    deviceType?: 'mobile' | 'tablet' | 'desktop';
  };
  notificationStats: {
    totalSent: number;
    totalDelivered: number;
    lastNotificationAt?: number;
    failureCount: number;
    lastFailureAt?: number;
    lastFailureReason?: string;
  };
  preferences: {
    enabled: boolean;
    allowedTypes: string[]; // ['reminders', 'overdue', 'recurring', etc.]
  };
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
    isArchived?: boolean;
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

// Unified Notification System Types
export interface NotificationDocument {
  id: string;
  userEmail: string;
  title: string;
  body: string;
  type: 'push' | 'in_app';
  relatedTaskId?: string;
  isRead: boolean;
  createdAt: number; // timestamp
  sentAt?: number; // when push was actually sent
  readAt?: number; // when marked as read
  data?: NotificationData; // additional context data
}

export interface NotificationData {
  taskId?: string;
  taskTitle?: string;
  priority?: Priority;
  category?: string;
  dueDate?: number;
  type?: 'task-overdue' | 'task-reminder' | 'daily-digest' | 'weekly-report' | 'system';
  taskCount?: number;
  completionRate?: number;
  streakDays?: number;
  metadata?: Record<string, any>;
}

export interface NotificationStats {
  totalNotifications: number;
  unreadCount: number;
  notificationsByType: Record<string, number>;
  lastNotificationAt?: number;
  dailyNotificationCount: number;
  weeklyNotificationCount: number;
}

export interface NotificationPreferencesV2 {
  enabled: boolean;
  pushEnabled: boolean;
  overdueReminders: boolean;
  dailyDigest: boolean;
  weeklyReport: boolean;
  taskReminders: boolean;
  systemNotifications: boolean;
  quietHours: {
    enabled: boolean;
    start: string; // "22:00"
    end: string;   // "08:00"
    timezone?: string;
  };
  reminderTiming: {
    beforeDue: number; // minutes before due date
    afterDue: number;  // minutes after due date for overdue reminders
    smartTiming?: boolean; // use AI to optimize timing
  };
  deliverySettings: {
    maxDailyNotifications: number;
    groupSimilar: boolean;
    batchDelay: number; // minutes to batch similar notifications
    priority: 'low' | 'normal' | 'high';
  };
  categories: {
    [key in TaskCategory]?: {
      enabled: boolean;
      priority: 'low' | 'normal' | 'high';
    };
  };
}

// Chat Types for AI Conversation Hub
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  suggestedTasks?: SuggestedTask[] | null;
  quickActions?: QuickAction[] | null;
  taskReferences?: TaskReference[] | null;
  metadata?: {
    processingTime?: number;
    tokensUsed?: number;
    error?: string;
  };
}

export interface SuggestedTask {
  title: string;
  description: string;
  category?: string;
  priority?: Priority;
  duration?: number;
  timeOfDay?: TimeOfDay;
}

export interface QuickAction {
  id: string;
  label: string;
  action: string;
  icon?: string;
  data?: any;
}

export interface TaskReference {
  taskId: string;
  taskTitle: string;
  action: 'view' | 'edit' | 'complete' | 'delete';
}

export interface ChatSession {
  id: string;
  userEmail: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  lastMessage?: string;
  isActive: boolean;
  context?: {
    taskCount: number;
    categoryCount: number;
    completedTasksCount: number;
  };
}

export interface ChatContext {
  tasks: Task[];
  categories: string[];
  accomplishments: Accomplishment[];
  userSettings?: {
    taskCategories: TaskCategory[];
    taskDurations: TaskDuration[];
    notificationPreferences?: NotificationPreferences;
  };
  recentActivity?: {
    completedTasks: number;
    createdTasks: number;
    overdueTasksCount: number;
  };
}

// ============================================================================
// TEAM COLLABORATION & WORKSPACE TYPES
// ============================================================================

export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Team {
  id: string;
  name: string;
  description?: string;
  ownerId: string; // User email
  ownerName?: string;
  createdAt: number;
  updatedAt: number;
  memberCount: number;
  isActive: boolean;
  settings: TeamSettings;
}

export interface TeamSettings {
  allowMemberInvites: boolean;
  defaultMemberRole: TeamRole;
  requireApprovalForTasks: boolean;
  autoAssignTasks: boolean;
  notificationSettings: {
    memberJoined: boolean;
    taskAssigned: boolean;
    projectUpdates: boolean;
  };
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string; // User email
  userName?: string;
  userAvatar?: string;
  role: TeamRole;
  joinedAt: number;
  lastActiveAt?: number;
  invitedBy: string; // Email of who invited them
  status: 'pending' | 'active' | 'inactive';
  permissions: TeamPermissions;
}

export interface TeamPermissions {
  canCreateTasks: boolean;
  canAssignTasks: boolean;
  canEditAllTasks: boolean;
  canDeleteTasks: boolean;
  canManageMembers: boolean;
  canManageSettings: boolean;
  canViewAnalytics: boolean;
  canManageTemplates: boolean;
}

export interface Workspace {
  id: string;
  teamId: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string; // User email
  isActive: boolean;
  memberIds: string[]; // User emails with access
  settings: WorkspaceSettings;
  stats: WorkspaceStats;
}

export interface WorkspaceSettings {
  defaultTaskCategory: TaskCategory;
  workingHours: { start: string; end: string; timezone: string };
  holidays: number[]; // timestamps
  taskAutoAssignment: boolean;
  notificationPreferences: NotificationSettings;
  calendarIntegration: boolean;
  timeTracking: boolean;
  requireTaskApproval: boolean;
}

export interface WorkspaceStats {
  totalTasks: number;
  completedTasks: number;
  activeTasks: number;
  overdueTasks: number;
  totalMembers: number;
  lastActivityAt?: number;
}

export interface NotificationSettings {
  enabled: boolean;
  taskAssignments: boolean;
  taskUpdates: boolean;
  deadlineReminders: boolean;
  teamUpdates: boolean;
  dailyDigest: boolean;
}

// ============================================================================
// ENHANCED TASK MANAGEMENT TYPES
// ============================================================================

export interface TeamTask extends Task {
  workspaceId?: string;
  teamId?: string;
  assigneeId?: string; // User email
  assigneeName?: string;
  assignedBy?: string; // User email
  assignedAt?: number;
  acceptedAt?: number;
  assignmentStatus?: 'pending' | 'accepted' | 'declined' | 'reassigned';
  assignmentNotes?: string;
  collaborators?: string[]; // User emails
  watchers?: string[]; // User emails who want to be notified
  dependsOn?: string[]; // Task IDs this task depends on
  blockedBy?: string[]; // Task IDs blocking this task
  templateId?: string; // ID of template used to create this task
  isFromTemplate?: boolean;
  automationRuleId?: string; // ID of automation rule that created this task
}

export interface TaskDependency {
  id: string;
  workspaceId: string;
  predecessorTaskId: string;
  successorTaskId: string;
  dependencyType: 'FS' | 'SS' | 'FF' | 'SF'; // Finish-to-Start, Start-to-Start, etc.
  lag: number; // days delay after predecessor
  createdAt: number;
  createdBy: string; // User email
}

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  category: 'individual' | 'team' | 'project';
  workspaceId?: string; // Workspace-specific templates
  isPublic: boolean;
  createdBy: string; // User email
  createdAt: number;
  updatedAt: number;
  usageCount: number;
  tags: string[];
  templateData: TaskTemplateData;
  version: number;
}

export interface TaskTemplateData {
  tasks: TaskTemplateItem[];
  estimatedDuration: number; // days
  teamRoles?: string[]; // Required roles
  milestones?: Milestone[];
  dependencies?: TemplateDependency[];
}

export interface TaskTemplateItem {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  priority: Priority;
  estimatedDuration: number;
  assigneeRole?: string; // 'developer', 'designer', 'manager', etc.
  subtasks?: TaskTemplateItem[];
  dependsOn?: string[]; // References to other template items
}

export interface TemplateDependency {
  predecessorId: string;
  successorId: string;
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lag: number;
}

export interface Milestone {
  id: string;
  title: string;
  description?: string;
  targetDate: number;
  completedAt?: number;
  taskIds: string[];
  progress: number; // 0-100
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: 'software' | 'marketing' | 'events' | 'content' | 'product' | 'hr' | 'custom';
  isPublic: boolean;
  createdBy: string;
  createdAt: number;
  usageCount: number;
  tasks: TaskTemplate[];
  estimatedDuration: number; // days
  teamRoles: TeamRole[];
  milestones: Milestone[];
  workspaceSettings?: Partial<WorkspaceSettings>;
}

// ============================================================================
// ADVANCED SEARCH & FILTERING TYPES
// ============================================================================

export interface SearchQuery {
  id?: string;
  name?: string; // for saved searches
  query: string;
  filters: SearchFilter[];
  sortBy: SortOption[];
  userId: string; // User email
  workspaceId?: string;
  isPublic: boolean;
  createdAt: number;
  lastUsedAt?: number;
  usageCount: number;
}

export interface SearchFilter {
  field: string; // 'title', 'category', 'priority', 'assignee', 'status', etc.
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'startsWith' | 'endsWith' | 'between' | 'in' | 'not_in' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty';
  value: any;
  logic?: 'AND' | 'OR';
}

export interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
}

export interface SearchResult {
  tasks: TeamTask[];
  totalCount: number;
  facets: SearchFacet[]; // aggregated filter options
  suggestions: string[]; // search suggestions
  executionTime: number;
  hasMore: boolean;
}

export interface SearchFacet {
  field: string;
  values: Array<{
    value: string;
    count: number;
    selected: boolean;
  }>;
}

// ============================================================================
// BATCH OPERATIONS TYPES
// ============================================================================

export interface BatchOperation {
  id: string;
  workspaceId?: string;
  operationType: 'update' | 'delete' | 'assign' | 'move' | 'complete' | 'archive' | 'duplicate';
  taskIds: string[];
  parameters: Record<string, any>;
  executedBy: string; // User email
  executedAt: number;
  completedAt?: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  results: BatchResult[];
  totalItems: number;
  processedItems: number;
  failedItems: number;
}

export interface BatchResult {
  taskId: string;
  success: boolean;
  error?: string;
  changes?: Record<string, any>;
  executedAt: number;
}

// ============================================================================
// AUTOMATION TYPES
// ============================================================================

export interface AutomationRule {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  isActive: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  createdBy: string; // User email
  createdAt: number;
  updatedAt: number;
  executionCount: number;
  lastExecuted?: number;
  lastExecutionStatus?: 'success' | 'failed' | 'partial';
  statistics: AutomationStatistics;
}

export interface AutomationTrigger {
  type: 'task_created' | 'task_updated' | 'task_completed' | 'task_assigned' | 'due_date_approaching' | 'schedule' | 'webhook' | 'manual';
  parameters?: Record<string, any>;
  schedule?: {
    frequency: 'once' | 'daily' | 'weekly' | 'monthly';
    time?: string; // "09:00"
    daysOfWeek?: number[]; // [1,2,3,4,5]
    dayOfMonth?: number; // 1-31
  };
}

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'is_empty' | 'is_not_empty';
  value: any;
  logic?: 'AND' | 'OR';
}

export interface AutomationAction {
  type: 'update_task' | 'create_task' | 'assign_task' | 'send_notification' | 'add_comment' | 'add_tag' | 'remove_tag' | 'move_to_workspace' | 'webhook' | 'email';
  parameters: Record<string, any>;
  delay?: number; // seconds to wait before executing
  condition?: AutomationCondition; // optional condition for this specific action
}

export interface AutomationStatistics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  lastSuccessAt?: number;
  lastFailureAt?: number;
  lastFailureReason?: string;
}

// ============================================================================
// TEAM ANALYTICS TYPES
// ============================================================================

export interface TeamAnalytics {
  workspaceId: string;
  teamId: string;
  period: 'day' | 'week' | 'month' | 'quarter' | 'year';
  startDate: number;
  endDate: number;
  generatedAt: number;
  teamMetrics: TeamMetrics;
  memberMetrics: MemberMetrics[];
  projectMetrics: ProjectMetrics[];
  trendData: TrendPoint[];
  insights: AIInsight[];
  recommendations: string[];
}

export interface TeamMetrics {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  completionRate: number;
  averageCompletionTime: number;
  collaborationScore: number; // 0-100
  productivityScore: number; // 0-100
  workloadDistribution: WorkloadDistribution;
  categoryDistribution: Record<string, number>;
  priorityDistribution: Record<string, number>;
}

export interface MemberMetrics {
  userId: string; // User email
  userName?: string;
  userAvatar?: string;
  role: TeamRole;
  tasksAssigned: number;
  tasksCompleted: number;
  completionRate: number;
  averageTaskDuration: number;
  overdueCount: number;
  collaborationCount: number; // tasks worked on with others
  productivityScore: number; // 0-100
  workloadScore: number; // relative to team average
  specializations: string[]; // categories they excel at
  trendsOverTime: TrendPoint[];
}

export interface ProjectMetrics {
  projectId: string;
  projectName: string;
  tasksCount: number;
  completedTasks: number;
  completionRate: number;
  estimatedDuration: number;
  actualDuration?: number;
  budgetVariance?: number; // if budget tracking is enabled
  riskScore: number; // 0-100
  milestoneProgress: Array<{
    milestone: string;
    progress: number;
    onTrack: boolean;
  }>;
}

export interface WorkloadDistribution {
  balanced: number; // percentage of team with balanced workload
  underutilized: number; // percentage underutilized
  overloaded: number; // percentage overloaded
  averageTasksPerMember: number;
  workloadVariance: number;
}

export interface TrendPoint {
  date: number; // timestamp
  value: number;
  change?: number; // change from previous period
  changePercentage?: number;
}

export interface AIInsight {
  id: string;
  type: 'productivity' | 'collaboration' | 'risk' | 'opportunity' | 'pattern';
  title: string;
  description: string;
  confidence: number; // 0-1
  impact: 'low' | 'medium' | 'high';
  actionable: boolean;
  suggestedAction?: string;
  relatedMetrics?: string[];
  generatedAt: number;
}

// ============================================================================
// COMMUNICATION & INTEGRATION TYPES
// ============================================================================

export interface TeamChatMessage {
  id: string;
  workspaceId: string;
  threadId: string; // taskId for task threads, channelId for workspace channels
  threadType: 'task' | 'workspace' | 'direct';
  senderId: string; // User email
  senderName?: string;
  senderAvatar?: string;
  content: string;
  timestamp: number;
  editedAt?: number;
  attachments?: Attachment[];
  mentions?: string[]; // User emails
  reactions?: Reaction[];
  isSystem?: boolean; // system-generated messages
  relatedTaskId?: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'file' | 'link' | 'task';
  url: string;
  size?: number;
  thumbnailUrl?: string;
}

export interface Reaction {
  emoji: string;
  userIds: string[]; // User emails
  count: number;
}

export interface Integration {
  id: string;
  workspaceId: string;
  type: 'slack' | 'teams' | 'discord' | 'webhook' | 'zapier';
  name: string;
  isActive: boolean;
  credentials: EncryptedCredentials;
  settings: IntegrationSettings;
  createdBy: string; // User email
  createdAt: number;
  lastSyncAt?: number;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  statistics: IntegrationStatistics;
}

export interface EncryptedCredentials {
  encryptedData: string;
  keyId: string;
  createdAt: number;
}

export interface IntegrationSettings {
  syncDirection: 'inbound' | 'outbound' | 'bidirectional';
  syncFrequency: 'realtime' | 'hourly' | 'daily' | 'manual';
  eventTypes: string[]; // which events to sync
  channelMapping: Record<string, string>; // local channel -> external channel
  userMapping: Record<string, string>; // local user -> external user
  filterRules: IntegrationFilter[];
}

export interface IntegrationFilter {
  field: string;
  operator: string;
  value: any;
  action: 'include' | 'exclude' | 'transform';
}

export interface IntegrationStatistics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  lastSyncDuration: number;
  itemsSynced: number;
  errorsEncountered: number;
}

// ============================================================================
// RESOURCE MANAGEMENT TYPES
// ============================================================================

export interface Resource {
  id: string;
  workspaceId: string;
  name: string;
  type: 'room' | 'equipment' | 'person' | 'virtual';
  description?: string;
  capacity?: number;
  location?: string;
  isActive: boolean;
  availableHours?: {
    start: string; // "09:00"
    end: string;   // "17:00"
    days: number[]; // [1,2,3,4,5]
  };
  bookings: ResourceBooking[];
  settings: ResourceSettings;
}

export interface ResourceBooking {
  id: string;
  resourceId: string;
  taskId?: string;
  userId: string; // User email
  title: string;
  startTime: number;
  endTime: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  attendees?: string[]; // User emails
  createdAt: number;
}

export interface ResourceSettings {
  requireApproval: boolean;
  maxBookingDuration: number; // hours
  advanceBookingDays: number; // how many days in advance
  allowRecurringBookings: boolean;
  autoRelease: boolean; // auto-release if not checked in
  notificationSettings: {
    bookingConfirmed: boolean;
    bookingCancelled: boolean;
    bookingReminder: boolean;
    reminderMinutes: number;
  };
}
