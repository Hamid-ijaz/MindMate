import { NextRequest, NextResponse } from 'next/server';
import { GoogleCalendarService } from '@/lib/calendar-sync/google-calendar';
import { googleCalendarService } from '@/lib/firestore';
import { taskService } from '@/lib/firestore';
import type { Task } from '@/lib/types';

const googleService = new GoogleCalendarService(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  process.env.GOOGLE_REDIRECT_URI!
);

export async function POST(request: NextRequest) {
  try {
    const { taskId, userEmail, action } = await request.json();

    if (!taskId || !userEmail) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Get Google Calendar settings
    const googleSettings = await googleCalendarService.getGoogleCalendarSettings(userEmail);
    
    if (!googleSettings || !googleSettings.isConnected) {
      return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 });
    }

    // Set tokens for the service
    googleService.setTokens(
      googleSettings.accessToken!,
      googleSettings.refreshToken,
      googleSettings.tokenExpiresAt
    );

    // Get the task
    const task = await taskService.getTask(taskId);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    let result;
    
    switch (action) {
      case 'create':
        result = await createGoogleCalendarEvent(task, googleSettings.defaultCalendarId || 'primary');
        break;
      case 'update':
        result = await updateGoogleCalendarEvent(task, googleSettings.defaultCalendarId || 'primary');
        break;
      case 'delete':
        result = await deleteGoogleCalendarEvent(task, googleSettings.defaultCalendarId || 'primary');
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Google Calendar sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync with Google Calendar' },
      { status: 500 }
    );
  }
}

async function createGoogleCalendarEvent(task: Task, calendarId: string) {
  try {
    const googleEvent = convertTaskToGoogleEvent(task);
    const createdEvent = await googleService.createEvent(calendarId, googleEvent);
    
    // Update task with Google Calendar info
    await googleCalendarService.syncTaskToGoogleCalendar(task.userEmail, task.id, {
      googleCalendarEventId: createdEvent.id,
      syncStatus: 'synced',
      lastSync: Date.now(),
      googleCalendarUrl: `https://calendar.google.com/calendar/event?eid=${btoa(createdEvent.id)}`
    });

    return {
      success: true,
      eventId: createdEvent.id,
      eventUrl: `https://calendar.google.com/calendar/event?eid=${btoa(createdEvent.id)}`
    };
  } catch (error) {
    await googleCalendarService.syncTaskToGoogleCalendar(task.userEmail, task.id, {
      syncStatus: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

async function updateGoogleCalendarEvent(task: Task, calendarId: string) {
  try {
    if (!task.googleCalendarEventId) {
      throw new Error('No Google Calendar event ID found');
    }

    const googleEvent = convertTaskToGoogleEvent(task);
    const updatedEvent = await googleService.updateEvent(calendarId, task.googleCalendarEventId, googleEvent);
    
    await googleCalendarService.syncTaskToGoogleCalendar(task.userEmail, task.id, {
      googleCalendarEventId: updatedEvent.id,
      syncStatus: 'synced',
      lastSync: Date.now()
    });

    return {
      success: true,
      eventId: updatedEvent.id,
      eventUrl: `https://calendar.google.com/calendar/event?eid=${btoa(updatedEvent.id)}`
    };
  } catch (error) {
    await googleCalendarService.syncTaskToGoogleCalendar(task.userEmail, task.id, {
      syncStatus: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

async function deleteGoogleCalendarEvent(task: Task, calendarId: string) {
  try {
    if (!task.googleCalendarEventId) {
      throw new Error('No Google Calendar event ID found');
    }

    await googleService.deleteEvent(calendarId, task.googleCalendarEventId);
    
    await googleCalendarService.syncTaskToGoogleCalendar(task.userEmail, task.id, {
      syncStatus: 'deleted',
      lastSync: Date.now()
    });

    return { success: true };
  } catch (error) {
    await googleCalendarService.syncTaskToGoogleCalendar(task.userEmail, task.id, {
      syncStatus: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

function convertTaskToGoogleEvent(task: Task) {
  const event: any = {
    summary: task.title,
    description: task.description || `Task from MindMate\nCategory: ${task.category}\nPriority: ${task.priority}`,
  };

  if (task.location) {
    event.location = task.location;
  }

  if (task.attendees && task.attendees.length > 0) {
    event.attendees = task.attendees.map(email => ({ email }));
  }

  // Set event timing
  if (task.reminderAt) {
    const startTime = new Date(task.reminderAt);
    const endTime = new Date(task.reminderAt + (task.duration * 60 * 1000)); // duration in minutes

    if (task.isAllDay) {
      // For all-day events, use date format
      event.start = {
        date: startTime.toISOString().split('T')[0],
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
      event.end = {
        date: endTime.toISOString().split('T')[0],
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
    } else {
      event.start = {
        dateTime: startTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
      event.end = {
        dateTime: endTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
    }
  } else {
    // If no reminder time, create an all-day event for today
    const today = new Date();
    event.start = {
      date: today.toISOString().split('T')[0],
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
    event.end = {
      date: today.toISOString().split('T')[0],
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }

  return event;
}
