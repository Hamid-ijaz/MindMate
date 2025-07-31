// Google Calendar Integration Service
import type { ExternalCalendar, SyncableCalendarEvent, CalendarSyncConfig } from '@/lib/types';

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus: string;
  }>;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: string;
      minutes: number;
    }>;
  };
  recurrence?: string[];
  status: string;
  updated: string;
  etag: string;
}

interface GoogleCalendarList {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  accessRole: string;
  colorId: string;
  backgroundColor: string;
  foregroundColor: string;
  selected?: boolean;
  timeZone: string;
}

export class GoogleCalendarService {
  private static readonly DISCOVERY_URL = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
  private static readonly SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ];

  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: number | null = null;

  constructor(
    private clientId: string,
    private clientSecret: string,
    private redirectUri: string
  ) {}

  /**
   * Initialize OAuth flow
   */
  getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: GoogleCalendarService.SCOPES.join(' '),
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent'
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange code for tokens: ${response.statusText}`);
    }

    const data = await response.json();
    
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<string> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.statusText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);

    return data.access_token;
  }

  /**
   * Set tokens for API calls
   */
  setTokens(accessToken: string, refreshToken?: string, expiresAt?: number) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken || null;
    this.tokenExpiresAt = expiresAt || null;
  }

  /**
   * Make authenticated API request
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    // Check if token needs refresh
    if (this.tokenExpiresAt && Date.now() >= this.tokenExpiresAt - 60000) { // 1 minute buffer
      if (this.refreshToken) {
        await this.refreshAccessToken(this.refreshToken);
      } else {
        throw new Error('Access token expired and no refresh token available');
      }
    }

    const response = await fetch(`https://www.googleapis.com/calendar/v3${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Google Calendar API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    return response.json();
  }

  /**
   * Get list of user's calendars
   */
  async getCalendarList(): Promise<GoogleCalendarList[]> {
    const response = await this.makeRequest('/users/me/calendarList');
    return response.items || [];
  }

  /**
   * Get events from a specific calendar
   */
  async getEvents(
    calendarId: string = 'primary',
    options: {
      timeMin?: string;
      timeMax?: string;
      maxResults?: number;
      singleEvents?: boolean;
      orderBy?: string;
      syncToken?: string;
    } = {}
  ): Promise<{
    events: GoogleCalendarEvent[];
    nextSyncToken?: string;
    nextPageToken?: string;
  }> {
    const params = new URLSearchParams();
    
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    const response = await this.makeRequest(
      `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`
    );

    return {
      events: response.items || [],
      nextSyncToken: response.nextSyncToken,
      nextPageToken: response.nextPageToken,
    };
  }

  /**
   * Create a new event
   */
  async createEvent(
    calendarId: string = 'primary',
    event: Partial<GoogleCalendarEvent>
  ): Promise<GoogleCalendarEvent> {
    return this.makeRequest(
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        body: JSON.stringify(event),
      }
    );
  }

  /**
   * Update an existing event
   */
  async updateEvent(
    calendarId: string = 'primary',
    eventId: string,
    event: Partial<GoogleCalendarEvent>
  ): Promise<GoogleCalendarEvent> {
    return this.makeRequest(
      `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        method: 'PUT',
        body: JSON.stringify(event),
      }
    );
  }

  /**
   * Delete an event
   */
  async deleteEvent(calendarId: string = 'primary', eventId: string): Promise<void> {
    await this.makeRequest(
      `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        method: 'DELETE',
      }
    );
  }

  /**
   * Convert MindMate task to Google Calendar event
   */
  taskToGoogleEvent(task: any): Partial<GoogleCalendarEvent> {
    const event: Partial<GoogleCalendarEvent> = {
      summary: task.title,
      description: task.description,
      location: task.location,
    };

    if (task.scheduledAt && task.scheduledEndAt) {
      if (task.isAllDay) {
        event.start = {
          date: new Date(task.scheduledAt).toISOString().split('T')[0],
        };
        event.end = {
          date: new Date(task.scheduledEndAt).toISOString().split('T')[0],
        };
      } else {
        event.start = {
          dateTime: new Date(task.scheduledAt).toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
        event.end = {
          dateTime: new Date(task.scheduledEndAt).toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      }
    }

    if (task.attendees && task.attendees.length > 0) {
      event.attendees = task.attendees.map((email: string) => ({
        email,
        responseStatus: 'needsAction',
      }));
    }

    if (task.reminderAt) {
      const reminderMinutes = Math.floor((task.scheduledAt - task.reminderAt) / (1000 * 60));
      event.reminders = {
        useDefault: false,
        overrides: [
          {
            method: 'popup',
            minutes: reminderMinutes,
          },
        ],
      };
    }

    return event;
  }

  /**
   * Convert Google Calendar event to MindMate task format
   */
  googleEventToTask(event: GoogleCalendarEvent): Partial<any> {
    const task: any = {
      title: event.summary,
      description: event.description,
      location: event.location,
      externalId: event.id,
      lastModified: new Date(event.updated).getTime(),
    };

    if (event.start?.dateTime) {
      task.scheduledAt = new Date(event.start.dateTime).getTime();
      task.isAllDay = false;
    } else if (event.start?.date) {
      task.scheduledAt = new Date(event.start.date).getTime();
      task.isAllDay = true;
    }

    if (event.end?.dateTime) {
      task.scheduledEndAt = new Date(event.end.dateTime).getTime();
    } else if (event.end?.date) {
      task.scheduledEndAt = new Date(event.end.date).getTime();
    }

    if (event.attendees && event.attendees.length > 0) {
      task.attendees = event.attendees.map(attendee => attendee.email);
    }

    return task;
  }

  /**
   * Sync events between MindMate and Google Calendar
   */
  async syncEvents(
    calendarId: string,
    localTasks: any[],
    syncToken?: string
  ): Promise<{
    added: any[];
    updated: any[];
    deleted: string[];
    conflicts: any[];
    nextSyncToken: string;
  }> {
    const result = {
      added: [] as any[],
      updated: [] as any[],
      deleted: [] as string[],
      conflicts: [] as any[],
      nextSyncToken: '',
    };

    try {
      // Get events from Google Calendar
      const { events: googleEvents, nextSyncToken } = await this.getEvents(calendarId, {
        singleEvents: true,
        orderBy: 'updated',
        syncToken,
      });

      result.nextSyncToken = nextSyncToken || '';

      // Create maps for efficient lookups
      const localTasksMap = new Map(localTasks.map(task => [task.externalId, task]));
      const googleEventsMap = new Map(googleEvents.map(event => [event.id, event]));

      // Process Google Calendar events
      for (const googleEvent of googleEvents) {
        const localTask = localTasksMap.get(googleEvent.id);

        if (!localTask) {
          // New event from Google Calendar
          const newTask = this.googleEventToTask(googleEvent);
          newTask.syncStatus = 'synced';
          result.added.push(newTask);
        } else {
          // Check for conflicts
          const googleLastModified = new Date(googleEvent.updated).getTime();
          const localLastModified = localTask.lastModified || localTask.updatedAt || 0;

          if (googleLastModified > localLastModified) {
            // Google Calendar version is newer
            const updatedTask = {
              ...localTask,
              ...this.googleEventToTask(googleEvent),
              syncStatus: 'synced',
            };
            result.updated.push(updatedTask);
          } else if (localLastModified > googleLastModified) {
            // Local version is newer - update Google Calendar
            const googleEventUpdate = this.taskToGoogleEvent(localTask);
            await this.updateEvent(calendarId, googleEvent.id, googleEventUpdate);
          }
        }
      }

      // Check for locally deleted events
      for (const localTask of localTasks) {
        if (localTask.externalId && !googleEventsMap.has(localTask.externalId)) {
          result.deleted.push(localTask.id);
        }
      }

    } catch (error) {
      console.error('Sync error:', error);
      throw error;
    }

    return result;
  }

  /**
   * Get user information
   */
  async getUserInfo(): Promise<{
    id: string;
    email: string;
    name: string;
    picture?: string;
  }> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    const data = await response.json();
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      picture: data.picture,
    };
  }
}
