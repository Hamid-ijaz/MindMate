import { NextRequest, NextResponse } from 'next/server';
import { CalendarSyncManager } from '@/lib/calendar-sync/sync-manager';
import type { CalendarSyncConfig } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, calendarIds, syncAll = false } = body;

    // You'll need to get the user's sync configuration from your database
    // For now, using a default configuration
    const syncConfig: CalendarSyncConfig = {
      enabledProviders: ['google', 'outlook'],
      syncInterval: 300000, // 5 minutes
      conflictResolution: 'manual',
      autoSync: true,
      syncDirection: 'two-way',
      includeCompletedTasks: false,
      calendarMapping: {},
      syncCategories: [],
    };

    const syncManager = new CalendarSyncManager(syncConfig);
    await syncManager.initialize();

    switch (action) {
      case 'sync_all': {
        // You would get actual tasks and calendars from your database
        const result = await syncManager.syncAllCalendars([], []);
        return NextResponse.json({
          success: true,
          result,
        });
      }

      case 'sync_calendar': {
        if (!calendarIds || !Array.isArray(calendarIds) || calendarIds.length === 0) {
          return NextResponse.json(
            { error: 'Calendar IDs are required for calendar sync' },
            { status: 400 }
          );
        }

        const results = [];
        for (const calendarId of calendarIds) {
          try {
            // You would get actual tasks from your database
            const result = await syncManager.syncCalendar(calendarId, []);
            results.push({ calendarId, result });
          } catch (error) {
            results.push({ 
              calendarId, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
          }
        }

        return NextResponse.json({
          success: true,
          results,
        });
      }

      case 'get_conflicts': {
        const conflicts = syncManager.getConflicts();
        return NextResponse.json({
          success: true,
          conflicts,
        });
      }

      case 'resolve_conflict': {
        const { conflictId, resolution, mergedData } = body;
        
        if (!conflictId || !resolution) {
          return NextResponse.json(
            { error: 'Conflict ID and resolution are required' },
            { status: 400 }
          );
        }

        await syncManager.resolveConflict(conflictId, resolution, mergedData);
        return NextResponse.json({
          success: true,
          message: 'Conflict resolved successfully',
        });
      }

      case 'test_connection': {
        const { calendarId } = body;
        
        if (!calendarId) {
          return NextResponse.json(
            { error: 'Calendar ID is required for connection test' },
            { status: 400 }
          );
        }

        const isConnected = await syncManager.testConnection(calendarId);
        return NextResponse.json({
          success: true,
          connected: isConnected,
        });
      }

      case 'schedule_auto_sync': {
        const { calendarId, frequency } = body;
        
        if (!calendarId || !frequency) {
          return NextResponse.json(
            { error: 'Calendar ID and frequency are required' },
            { status: 400 }
          );
        }

        await syncManager.scheduleAutoSync(calendarId, frequency);
        return NextResponse.json({
          success: true,
          message: 'Auto-sync scheduled successfully',
        });
      }

      case 'get_sync_status': {
        const status = await syncManager.getSyncStatus();
        return NextResponse.json({
          success: true,
          status,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Sync API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Default sync configuration
    const syncConfig: CalendarSyncConfig = {
      enabledProviders: ['google', 'outlook'],
      syncInterval: 300000,
      conflictResolution: 'manual',
      autoSync: true,
      syncDirection: 'two-way',
      includeCompletedTasks: false,
      calendarMapping: {},
      syncCategories: ['work', 'personal'], // Added required property
    };

    const syncManager = new CalendarSyncManager(syncConfig);
    await syncManager.initialize();

    switch (action) {
      case 'status': {
        const status = await syncManager.getSyncStatus();
        return NextResponse.json({
          success: true,
          status,
        });
      }

      case 'conflicts': {
        const conflicts = syncManager.getConflicts();
        return NextResponse.json({
          success: true,
          conflicts,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Sync API GET error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
