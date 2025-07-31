// Outlook Calendar Integration Service
import type { ExternalCalendar, SyncableCalendarEvent } from '@/lib/types';

interface OutlookEvent {
  id: string;
  subject: string;
  body?: {
    contentType: string;
    content: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName: string;
  };
  attendees?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
    status: {
      response: string;
      time: string;
    };
  }>;
  isAllDay: boolean;
  recurrence?: any;
  lastModifiedDateTime: string;
  '@odata.etag': string;
}

interface OutlookCalendar {
  id: string;
  name: string;
  color: string;
  isDefaultCalendar: boolean;
  canEdit: boolean;
  canShare: boolean;
  canViewPrivateItems: boolean;
  owner: {
    name: string;
    address: string;
  };
}

export class OutlookCalendarService {
  private static readonly GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
  private static readonly SCOPES = [
    'https://graph.microsoft.com/Calendars.ReadWrite',
    'https://graph.microsoft.com/User.Read'
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
   * Get OAuth authorization URL
   */
  getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: OutlookCalendarService.SCOPES.join(' '),
      response_mode: 'query',
      state: crypto.randomUUID(), // Add CSRF protection
    });

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to exchange code for tokens: ${JSON.stringify(error)}`);
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
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<string> {
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
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
      const error = await response.json();
      throw new Error(`Failed to refresh token: ${JSON.stringify(error)}`);
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
   * Make authenticated request to Microsoft Graph API
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

    const response = await fetch(`${OutlookCalendarService.GRAPH_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Microsoft Graph API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  /**
   * Get user's calendars
   */
  async getCalendars(): Promise<OutlookCalendar[]> {
    const response = await this.makeRequest('/me/calendars');
    return response.value || [];
  }

  /**
   * Get events from a calendar
   */
  async getEvents(
    calendarId: string,
    options: {
      startDateTime?: string;
      endDateTime?: string;
      top?: number;
      orderby?: string;
      select?: string[];
      filter?: string;
    } = {}
  ): Promise<OutlookEvent[]> {
    const params = new URLSearchParams();
    
    if (options.startDateTime && options.endDateTime) {
      params.append('startDateTime', options.startDateTime);
      params.append('endDateTime', options.endDateTime);
    }
    
    if (options.top) params.append('$top', options.top.toString());
    if (options.orderby) params.append('$orderby', options.orderby);
    if (options.select) params.append('$select', options.select.join(','));
    if (options.filter) params.append('$filter', options.filter);

    const endpoint = calendarId === 'primary' 
      ? `/me/events?${params.toString()}`
      : `/me/calendars/${calendarId}/events?${params.toString()}`;

    const response = await this.makeRequest(endpoint);
    return response.value || [];
  }

  /**
   * Create a new event
   */
  async createEvent(
    calendarId: string,
    event: Partial<OutlookEvent>
  ): Promise<OutlookEvent> {
    const endpoint = calendarId === 'primary' 
      ? '/me/events'
      : `/me/calendars/${calendarId}/events`;

    return this.makeRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  /**
   * Update an existing event
   */
  async updateEvent(
    calendarId: string,
    eventId: string,
    event: Partial<OutlookEvent>
  ): Promise<OutlookEvent> {
    const endpoint = calendarId === 'primary'
      ? `/me/events/${eventId}`
      : `/me/calendars/${calendarId}/events/${eventId}`;

    return this.makeRequest(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(event),
    });
  }

  /**
   * Delete an event
   */
  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    const endpoint = calendarId === 'primary'
      ? `/me/events/${eventId}`
      : `/me/calendars/${calendarId}/events/${eventId}`;

    await this.makeRequest(endpoint, {
      method: 'DELETE',
    });
  }

  /**
   * Convert MindMate task to Outlook event
   */
  taskToOutlookEvent(task: any): Partial<OutlookEvent> {
    const event: Partial<OutlookEvent> = {
      subject: task.title,
      isAllDay: task.isAllDay || false,
    };

    if (task.description) {
      event.body = {
        contentType: 'Text',
        content: task.description,
      };
    }

    if (task.location) {
      event.location = {
        displayName: task.location,
      };
    }

    if (task.scheduledAt && task.scheduledEndAt) {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      if (task.isAllDay) {
        // For all-day events, use date format
        event.start = {
          dateTime: new Date(task.scheduledAt).toISOString().split('T')[0],
          timeZone: 'UTC',
        };
        event.end = {
          dateTime: new Date(task.scheduledEndAt).toISOString().split('T')[0],
          timeZone: 'UTC',
        };
      } else {
        event.start = {
          dateTime: new Date(task.scheduledAt).toISOString(),
          timeZone,
        };
        event.end = {
          dateTime: new Date(task.scheduledEndAt).toISOString(),
          timeZone,
        };
      }
    }

    if (task.attendees && task.attendees.length > 0) {
      event.attendees = task.attendees.map((email: string) => ({
        emailAddress: {
          address: email,
        },
        status: {
          response: 'none',
          time: new Date().toISOString(),
        },
      }));
    }

    return event;
  }

  /**
   * Convert Outlook event to MindMate task
   */
  outlookEventToTask(event: OutlookEvent): Partial<any> {
    const task: any = {
      title: event.subject,
      description: event.body?.content,
      location: event.location?.displayName,
      externalId: event.id,
      lastModified: new Date(event.lastModifiedDateTime).getTime(),
      isAllDay: event.isAllDay,
    };

    if (event.start?.dateTime) {
      task.scheduledAt = new Date(event.start.dateTime).getTime();
    }

    if (event.end?.dateTime) {
      task.scheduledEndAt = new Date(event.end.dateTime).getTime();
    }

    if (event.attendees && event.attendees.length > 0) {
      task.attendees = event.attendees.map(attendee => attendee.emailAddress.address);
    }

    return task;
  }

  /**
   * Sync events with Outlook Calendar
   */
  async syncEvents(
    calendarId: string,
    localTasks: any[],
    deltaLink?: string
  ): Promise<{
    added: any[];
    updated: any[];
    deleted: string[];
    conflicts: any[];
    nextDeltaLink: string;
  }> {
    const result = {
      added: [] as any[],
      updated: [] as any[],
      deleted: [] as string[],
      conflicts: [] as any[],
      nextDeltaLink: '',
    };

    try {
      let endpoint: string;
      
      if (deltaLink) {
        // Use delta link for incremental sync
        endpoint = deltaLink.replace(OutlookCalendarService.GRAPH_BASE_URL, '');
      } else {
        // Initial sync - get all events
        const params = new URLSearchParams({
          '$select': 'id,subject,body,start,end,location,attendees,isAllDay,lastModifiedDateTime',
          '$orderby': 'lastModifiedDateTime desc',
        });
        
        endpoint = calendarId === 'primary'
          ? `/me/events/delta?${params.toString()}`
          : `/me/calendars/${calendarId}/events/delta?${params.toString()}`;
      }

      const response = await this.makeRequest(endpoint);
      const outlookEvents = response.value || [];
      result.nextDeltaLink = response['@odata.deltaLink'] || response['@odata.nextLink'] || '';

      // Create maps for efficient lookups
      const localTasksMap = new Map(localTasks.map(task => [task.externalId, task]));
      const outlookEventsMap = new Map(outlookEvents.map((event: OutlookEvent) => [event.id, event]));

      // Process Outlook events
      for (const outlookEvent of outlookEvents) {
        // Check if event was deleted
        if (outlookEvent['@removed']) {
          const localTask = localTasksMap.get(outlookEvent.id);
          if (localTask) {
            result.deleted.push(localTask.id);
          }
          continue;
        }

        const localTask = localTasksMap.get(outlookEvent.id);

        if (!localTask) {
          // New event from Outlook
          const newTask = this.outlookEventToTask(outlookEvent);
          newTask.syncStatus = 'synced';
          result.added.push(newTask);
        } else {
          // Check for conflicts
          const outlookLastModified = new Date(outlookEvent.lastModifiedDateTime).getTime();
          const localLastModified = localTask.lastModified || localTask.updatedAt || 0;

          if (outlookLastModified > localLastModified) {
            // Outlook version is newer
            const updatedTask = {
              ...localTask,
              ...this.outlookEventToTask(outlookEvent),
              syncStatus: 'synced',
            };
            result.updated.push(updatedTask);
          } else if (localLastModified > outlookLastModified) {
            // Local version is newer - update Outlook
            const outlookEventUpdate = this.taskToOutlookEvent(localTask);
            await this.updateEvent(calendarId, outlookEvent.id, outlookEventUpdate);
          }
        }
      }

    } catch (error) {
      console.error('Outlook sync error:', error);
      throw error;
    }

    return result;
  }

  /**
   * Get user information
   */
  async getUserInfo(): Promise<{
    id: string;
    displayName: string;
    mail: string;
    userPrincipalName: string;
  }> {
    return this.makeRequest('/me?$select=id,displayName,mail,userPrincipalName');
  }
}
