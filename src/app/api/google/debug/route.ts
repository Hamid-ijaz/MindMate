import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import { googleTasksService } from '@/lib/firestore';
import { googleTasksIntegration } from '@/services/google-tasks';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 GET /api/google/debug - Starting debug check');

    const userEmail = await getAuthenticatedUserEmail(request);
    if (!userEmail) {
      console.log('❌ GET /api/google/debug - Authentication failed');
      return NextResponse.json({
        error: 'Not authenticated',
        timestamp: new Date().toISOString()
      }, { status: 401 });
    }

    console.log(`👤 GET /api/google/debug - Checking Google Tasks status for: ${userEmail}`);

    // Get Google Tasks settings
    const settings = await googleTasksService.getGoogleTasksSettings(userEmail);
    console.log('⚙️ Google Tasks settings:', {
      isConnected: settings?.isConnected,
      syncEnabled: settings?.syncEnabled,
      hasAccessToken: !!settings?.accessToken,
      hasRefreshToken: !!settings?.refreshToken,
      tokenExpiresAt: settings?.tokenExpiresAt ? new Date(settings.tokenExpiresAt).toISOString() : null,
      defaultTaskListId: settings?.defaultTaskListId,
      onDeletedTasksAction: settings?.onDeletedTasksAction
    });

    const debugInfo = {
      timestamp: new Date().toISOString(),
      userEmail,
      settings: {
        isConnected: settings?.isConnected || false,
        syncEnabled: settings?.syncEnabled || false,
        hasAccessToken: !!settings?.accessToken,
        hasRefreshToken: !!settings?.refreshToken,
        tokenExpiresAt: settings?.tokenExpiresAt ? new Date(settings.tokenExpiresAt).toISOString() : null,
        defaultTaskListId: settings?.defaultTaskListId,
        onDeletedTasksAction: settings?.onDeletedTasksAction
      },
      connectivityTest: null as any,
      taskLists: null as any,
      recentTasks: null as any
    };

    // Test connectivity if connected
    if (settings?.isConnected && settings?.accessToken) {
      try {
        console.log('🔗 Testing Google Tasks API connectivity...');
        const taskLists = await googleTasksIntegration.getTaskLists(userEmail);
        debugInfo.connectivityTest = {
          success: true,
          taskListsCount: taskLists.length,
          taskLists: taskLists.slice(0, 3).map(tl => ({ id: tl.id, title: tl.title })) // First 3 only
        };

        // Try to get tasks from default list
        if (taskLists.length > 0) {
          const defaultListId = settings.defaultTaskListId || taskLists[0].id;
          if (defaultListId) {
            const tasks = await googleTasksIntegration.getTasks(userEmail, defaultListId);
            debugInfo.recentTasks = {
              listId: defaultListId,
              totalTasks: tasks.length,
              recentTasks: tasks.slice(0, 5).map(t => ({
                id: t.id,
                title: t.title,
                status: t.status,
                updated: t.updated
              }))
            };
          }
        }

        debugInfo.taskLists = taskLists.map(tl => ({
          id: tl.id,
          title: tl.title,
          updated: tl.updated
        }));

      } catch (connectivityError) {
        console.error('❌ Connectivity test failed:', connectivityError);
        debugInfo.connectivityTest = {
          success: false,
          error: connectivityError instanceof Error ? connectivityError.message : 'Unknown error',
          stack: connectivityError instanceof Error ? connectivityError.stack : undefined
        };
      }
    } else {
      console.log('⏭️ Skipping connectivity test - not connected or no access token');
      debugInfo.connectivityTest = {
        success: false,
        reason: 'Not connected or missing access token'
      };
    }

    console.log('✅ Debug check completed');
    return NextResponse.json(debugInfo);

  } catch (error) {
    console.error('❌ GET /api/google/debug - Error:', error);
    return NextResponse.json({
      error: 'Debug check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
