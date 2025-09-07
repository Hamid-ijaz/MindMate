import { google, tasks_v1 } from 'googleapis';
import type { GoogleTasksSettings, Task, Priority, TaskCategory, TaskDuration } from '@/lib/types';
import { googleTasksService } from '@/lib/firestore';

interface GoogleTasksCredentials {
  accessToken: string;
  refreshToken: string;
  expiryDate?: number;
}

class GoogleTasksService {
  private oauth2Client: any;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_OAUTH_REDIRECT || `${process.env.NEXTAUTH_URL}/api/google/callback`
    );
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/tasks'],
      prompt: 'consent'
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<GoogleTasksCredentials> {
    const { tokens } = await this.oauth2Client.getToken(code);
    return {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
      expiryDate: tokens.expiry_date
    };
  }

  /**
   * Set credentials for the OAuth client
   */
  private setCredentials(credentials: GoogleTasksCredentials) {
    this.oauth2Client.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
      expiry_date: credentials.expiryDate
    });
  }

  /**
   * Public helper to apply tokens to the internal OAuth client.
   * Useful during the OAuth callback when tokens are available but
   * not yet persisted to Firestore.
   */
  public setCredentialsFromTokens(credentials: GoogleTasksCredentials) {
    this.setCredentials(credentials);
  }

  /**
   * Get authenticated Google Tasks API client
   */
  private async getTasksApi(userEmail: string): Promise<tasks_v1.Tasks> {
    console.log('🔧 getTasksApi: Getting authenticated API client for', userEmail);
    
    const settings = await googleTasksService.getGoogleTasksSettings(userEmail);
    console.log('⚙️ Retrieved settings:', {
      isConnected: settings?.isConnected || false,
      hasAccessToken: !!(settings?.accessToken),
      hasRefreshToken: !!(settings?.refreshToken),
      tokenExpiresAt: settings?.tokenExpiresAt ? new Date(settings.tokenExpiresAt).toISOString() : 'none'
    });
    
    if (!settings || !settings.isConnected || !settings.refreshToken) {
      console.error('❌ Google Tasks not connected for this user:', userEmail);
      console.error('Settings state:', { 
        settingsExists: !!settings, 
        isConnected: settings?.isConnected, 
        hasRefreshToken: !!settings?.refreshToken 
      });
      throw new Error('Google Tasks not connected for this user');
    }

    // Check if token is expired and refresh if needed
    const now = Date.now();
    const tokenExpiry = settings.tokenExpiresAt || 0;
    const isTokenExpired = now >= tokenExpiry;
    
    console.log('� Token expiry check:', {
      now: new Date(now).toISOString(),
      tokenExpiry: new Date(tokenExpiry).toISOString(),
      isExpired: isTokenExpired
    });

    if (isTokenExpired) {
      console.log('🔄 Token expired, refreshing...');
      try {
        await this.refreshAccessToken(userEmail);
        console.log('✅ Token refreshed successfully');
        
        // Get updated settings after refresh
        const updatedSettings = await googleTasksService.getGoogleTasksSettings(userEmail);
        if (!updatedSettings?.accessToken) {
          throw new Error('Failed to get updated token after refresh');
        }
        
        this.setCredentials({
          accessToken: updatedSettings.accessToken,
          refreshToken: updatedSettings.refreshToken!,
          expiryDate: updatedSettings.tokenExpiresAt
        });
      } catch (refreshError) {
        console.error('❌ Failed to refresh token:', refreshError);
        throw new Error('Failed to refresh expired token');
      }
    } else {
      console.log('✅ Token is still valid, using existing credentials');
      this.setCredentials({
        accessToken: settings.accessToken!,
        refreshToken: settings.refreshToken,
        expiryDate: settings.tokenExpiresAt
      });
    }

    console.log('✅ Google Tasks API client ready');
    return google.tasks({ version: 'v1', auth: this.oauth2Client });
  }

  /**
   * Get all task lists for the user (bypassing stored settings)
   * Useful during OAuth callback when tokens are fresh but not yet stored
   */
  async getTaskListsWithCredentials(credentials: GoogleTasksCredentials): Promise<tasks_v1.Schema$TaskList[]> {
    console.log('📋 getTaskListsWithCredentials: Using provided credentials directly');
    
    this.setCredentials(credentials);
    const tasksApi = google.tasks({ version: 'v1', auth: this.oauth2Client });
    
    console.log('🌐 Making Google API call to fetch task lists...');
    const response = await tasksApi.tasklists.list();
    console.log('✅ Got task lists response:', response.data.items?.length || 0, 'lists');
    
    return response.data.items || [];
  }

  /**
   * Get all task lists for the user
   */
  async getTaskLists(userEmail: string): Promise<tasks_v1.Schema$TaskList[]> {
    try {
      const tasksApi = await this.getTasksApi(userEmail);
      const response = await tasksApi.tasklists.list();
      return response.data.items || [];
    } catch (error) {
      console.error('Error fetching Google task lists:', error);
      throw error;
    }
  }

  /**
   * Get tasks from a specific task list
   */
  async getTasks(userEmail: string, taskListId?: string): Promise<tasks_v1.Schema$Task[]> {
    try {
      const tasksApi = await this.getTasksApi(userEmail);
      const settings = await googleTasksService.getGoogleTasksSettings(userEmail);
      const listId = taskListId || settings?.defaultTaskListId || '@default';

      const response = await tasksApi.tasks.list({
        tasklist: listId,
        showCompleted: true,
        showDeleted: false,
        showHidden: true
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Error fetching Google tasks:', error);
      throw error;
    }
  }

  /**
   * Create a new task in Google Tasks
   */
  async createTask(
    userEmail: string, 
    task: Task, 
    taskListId?: string,
    parentGoogleTaskId?: string
  ): Promise<tasks_v1.Schema$Task> {
    try {
      console.log(`🆕 createTask: Starting creation for task: ${task.title}`);

      const tasksApi = await this.getTasksApi(userEmail);
      console.log(`🔗 createTask: Tasks API client obtained for user: ${userEmail}`);

      const settings = await googleTasksService.getGoogleTasksSettings(userEmail);
      const listId = taskListId || settings?.defaultTaskListId || '@default';

      console.log(`📋 createTask: Using task list: ${listId}`, {
        providedTaskListId: taskListId,
        defaultFromSettings: settings?.defaultTaskListId,
        fallbackToDefault: !taskListId && !settings?.defaultTaskListId
      });

      const googleTask: tasks_v1.Schema$Task = {
        title: task.title,
        notes: task.description || undefined,
        due: task.reminderAt ? new Date(task.reminderAt).toISOString() : undefined,
        status: task.completedAt ? 'completed' : 'needsAction',
        parent: parentGoogleTaskId || undefined
      };

      console.log(`📝 createTask: Google task data to create:`, {
        title: googleTask.title,
        hasNotes: !!googleTask.notes,
        hasDue: !!googleTask.due,
        status: googleTask.status,
        hasParent: !!googleTask.parent,
        parentId: googleTask.parent
      });

      console.log(`📤 createTask: Calling Google Tasks API insert...`);
      const response = await tasksApi.tasks.insert({
        tasklist: listId,
        requestBody: googleTask,
        parent: parentGoogleTaskId || undefined
      });

      console.log(`✅ createTask: Google task created successfully:`, {
        id: response.data.id,
        title: response.data.title,
        selfLink: response.data.selfLink
      });

      console.log(`✅ Created Google task: ${task.title}${parentGoogleTaskId ? ' (as subtask)' : ''}`);
      return response.data;
    } catch (error) {
      console.error('❌ createTask: Error creating Google task:', {
        taskTitle: task.title,
        userEmail,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Update an existing task in Google Tasks
   */
  async updateTask(
    userEmail: string,
    googleTaskId: string,
    task: Task,
    taskListId?: string,
    parentGoogleTaskId?: string
  ): Promise<tasks_v1.Schema$Task> {
    try {
      const tasksApi = await this.getTasksApi(userEmail);
      const settings = await googleTasksService.getGoogleTasksSettings(userEmail);
      const listId = taskListId || settings?.defaultTaskListId || '@default';

      const googleTask: tasks_v1.Schema$Task = {
        id: googleTaskId,
        title: task.title,
        notes: task.description || undefined,
        due: task.reminderAt ? new Date(task.reminderAt).toISOString() : undefined,
        status: task.completedAt ? 'completed' : 'needsAction',
        parent: parentGoogleTaskId || undefined
      };

      console.log(`🔄 Updating Google task ${googleTaskId}:`, {
        title: task.title,
        status: googleTask.status,
        completedAt: task.completedAt,
        isUncompleting: !task.completedAt
      });

      const response = await tasksApi.tasks.update({
        tasklist: listId,
        task: googleTaskId,
        requestBody: googleTask
      });

      console.log(`✅ Updated Google task: ${task.title}${parentGoogleTaskId ? ' (subtask)' : ''}`);
      return response.data;
    } catch (error) {
      console.error('Error updating Google task:', error);
      throw error;
    }
  }

  /**
   * Delete a task from Google Tasks
   */
  async deleteTask(
    userEmail: string,
    googleTaskId: string,
    taskListId?: string
  ): Promise<void> {
    try {
      const tasksApi = await this.getTasksApi(userEmail);
      const settings = await googleTasksService.getGoogleTasksSettings(userEmail);
      const listId = taskListId || settings?.defaultTaskListId || '@default';

      await tasksApi.tasks.delete({
        tasklist: listId,
        task: googleTaskId
      });
    } catch (error) {
      console.error('Error deleting Google task:', error);
      throw error;
    }
  }

  /**
   * Convert Google Task to app Task format
   */
  convertGoogleTaskToAppTask(googleTask: tasks_v1.Schema$Task, userEmail: string): Omit<Task, 'id' | 'userEmail'> {
    return {
      title: googleTask.title || 'Untitled Task',
      description: googleTask.notes || '',
      reminderAt: googleTask.due ? new Date(googleTask.due).getTime() : undefined,
      completedAt: googleTask.status === 'completed' && googleTask.completed 
        ? new Date(googleTask.completed).getTime() 
        : undefined,
      createdAt: googleTask.updated ? new Date(googleTask.updated).getTime() : Date.now(),
      updatedAt: googleTask.updated ? new Date(googleTask.updated).getTime() : Date.now(),
      syncToGoogleTasks: true,
      googleTaskId: googleTask.id || null,
      googleTaskLastSync: Date.now(),
      googleTaskSyncStatus: 'synced',
      rejectionCount: 0,
      isMuted: false,
      priority: 'medium' as Priority,
      category: 'Uncategorized' as TaskCategory,
      duration: 30
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(userEmail: string): Promise<void> {
    try {
      const settings = await googleTasksService.getGoogleTasksSettings(userEmail);
      if (!settings || !settings.refreshToken) {
        throw new Error('No refresh token available');
      }

      this.oauth2Client.setCredentials({
        refresh_token: settings.refreshToken
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      await googleTasksService.updateGoogleTasksSettings(userEmail, {
        accessToken: credentials.access_token!,
        tokenExpiresAt: credentials.expiry_date,
        syncStatus: 'success',
        lastError: undefined
      });
    } catch (error) {
      console.error('Error refreshing access token:', error);
      await googleTasksService.updateGoogleTasksSettings(userEmail, {
        syncStatus: 'error',
        lastError: 'Failed to refresh access token'
      });
      throw error;
    }
  }
}

export const googleTasksIntegration = new GoogleTasksService();
