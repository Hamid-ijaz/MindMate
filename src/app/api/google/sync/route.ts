import { NextRequest, NextResponse } from 'next/server';
import { googleTasksSyncService } from '@/services/google-tasks-sync';
import { googleTasksService } from '@/lib/firestore';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';

// GET - Get Google Tasks connection status
export async function GET(request: NextRequest) {
  try {
    const userEmail = await getAuthenticatedUserEmail(request);
    if (!userEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const settings = await googleTasksService.getGoogleTasksSettings(userEmail);
    
    return NextResponse.json({
      isConnected: settings?.isConnected || false,
      syncEnabled: settings?.syncEnabled || false,
      syncStatus: settings?.syncStatus || 'idle',
      lastSyncAt: settings?.lastSyncAt,
      defaultTaskListId: settings?.defaultTaskListId,
      syncDirection: settings?.syncDirection || 'bidirectional',
      autoSync: settings?.autoSync || false,
      lastError: settings?.lastError
    });
  } catch (error) {
    console.error('Error getting Google Tasks status:', error);
    return NextResponse.json(
      { error: 'Failed to get connection status' },
      { status: 500 }
    );
  }
}

// POST - Trigger manual sync or bulk sync
export async function POST(request: NextRequest) {
  try {
    // Check for internal requests (from comprehensive check)
    const internalUserEmail = request.headers.get('x-user-email');
    let userEmail = internalUserEmail;
    
    if (!internalUserEmail) {
      // Regular user request - authenticate normally
      userEmail = await getAuthenticatedUserEmail(request);
      if (!userEmail) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
    }

    if (!userEmail) {
      return NextResponse.json({ error: 'No user email provided' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { action } = body;

    // Handle interval sync (for comprehensive check)
    if (action === 'intervalSync') {
      const result = await googleTasksSyncService.performIntervalSync(userEmail);
      return NextResponse.json(result);
    }

    // Handle full sync (for both regular and internal requests)
    if (action === 'fullSync') {
      const result = await googleTasksSyncService.syncUserTasks(userEmail);
      return NextResponse.json(result);
    }

    // Handle bulk sync of incomplete tasks
    if (action === 'syncAllIncomplete') {
      const result = await googleTasksSyncService.syncAllIncompleteTasksToGoogle(userEmail);
      return NextResponse.json(result);
    }

    // Handle regular full sync (existing functionality)
    const result = await googleTasksSyncService.syncUserTasks(userEmail);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error triggering sync:', error);
    return NextResponse.json(
      { error: 'Failed to sync tasks' },
      { status: 500 }
    );
  }
}

// DELETE - Handle task deletion sync or disconnect Google Tasks
export async function DELETE(request: NextRequest) {
  try {
    const userEmail = await getAuthenticatedUserEmail(request);
    if (!userEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);

    // Handle task deletion sync
    if (body?.action === 'deleteTask' && body?.taskId) {
      try {
        await googleTasksSyncService.syncTaskDeletion(userEmail, body.taskId, body.googleTaskId);
        return NextResponse.json({ success: true, taskId: body.taskId });
      } catch (error) {
        console.error(`Error syncing task deletion ${body.taskId}:`, error);
        return NextResponse.json(
          { error: `Failed to sync task deletion ${body.taskId}` },
          { status: 500 }
        );
      }
    }

    // Handle disconnect Google Tasks (original functionality)
    await googleTasksService.disconnectGoogleTasks(userEmail);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

// (auth helper imported from src/lib/auth-utils)

// PATCH - Handle individual task sync or update settings
export async function PATCH(request: NextRequest) {
  try {
    console.log('🔍 PATCH /api/google/sync - Starting request processing');

    const userEmail = await getAuthenticatedUserEmail(request);
    if (!userEmail) {
      console.log('❌ PATCH /api/google/sync - Authentication failed');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log(`👤 PATCH /api/google/sync - Authenticated user: ${userEmail}`);

    const body = await request.json();
    const { action, taskId, defaultTaskListId, onDeletedTasksAction, syncDirection, autoSync } = body;

    console.log('📋 PATCH /api/google/sync - Request body:', {
      action,
      taskId,
      hasDefaultTaskListId: !!defaultTaskListId,
      hasOnDeletedTasksAction: !!onDeletedTasksAction,
      hasSyncDirection: !!syncDirection,
      hasAutoSync: autoSync !== undefined
    });

    // Handle task sync action
    if (action === 'syncTask' && taskId) {
      console.log(`🔄 PATCH /api/google/sync - Starting task sync for taskId: ${taskId}`);
      try {
        await googleTasksSyncService.pushTaskChange(userEmail, taskId);
        console.log(`✅ PATCH /api/google/sync - Task sync completed for taskId: ${taskId}`);
        return NextResponse.json({ success: true, taskId });
      } catch (error) {
        console.error(`❌ PATCH /api/google/sync - Error syncing task ${taskId}:`, error);
        return NextResponse.json(
          { error: `Failed to sync task ${taskId}` },
          { status: 500 }
        );
      }
    }

    // Handle settings update
    const settingsUpdate: any = {};
    if (defaultTaskListId) {
      settingsUpdate.defaultTaskListId = defaultTaskListId;
    }
    if (onDeletedTasksAction) {
      console.log(`📝 Updating onDeletedTasksAction to: ${onDeletedTasksAction}`);
      settingsUpdate.onDeletedTasksAction = onDeletedTasksAction;
    }
    if (syncDirection) {
      settingsUpdate.syncDirection = syncDirection;
    }
    if (autoSync !== undefined) {
      settingsUpdate.autoSync = autoSync;
    }

    if (Object.keys(settingsUpdate).length > 0) {
      console.log(`💾 Saving settings update:`, settingsUpdate);
      await googleTasksService.updateGoogleTasksSettings(userEmail, settingsUpdate);
      console.log(`✅ Settings saved successfully`);
      return NextResponse.json({ success: true, ...settingsUpdate });
    }

    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  } catch (error) {
    console.error('Error in PATCH request:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
