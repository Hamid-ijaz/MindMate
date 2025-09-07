import { NextRequest, NextResponse } from 'next/server';
import { google, tasks_v1 } from 'googleapis';
import { googleTasksIntegration } from '@/services/google-tasks';
import { googleTasksService } from '@/lib/firestore';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';

// Helper function to get task lists directly using credentials
async function getTaskListsDirectly(credentials: {
  accessToken: string;
  refreshToken: string;
  expiryDate?: number;
}): Promise<tasks_v1.Schema$TaskList[]> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT || `${process.env.NEXTAUTH_URL}/api/google/callback`
  );

  oauth2Client.setCredentials({
    access_token: credentials.accessToken,
    refresh_token: credentials.refreshToken,
    expiry_date: credentials.expiryDate
  });

  const tasksApi = google.tasks({ version: 'v1', auth: oauth2Client });
  const response = await tasksApi.tasklists.list();
  return response.data.items || [];
}

export async function GET(request: NextRequest) {
  console.log('🔄 Google OAuth callback started');
  
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    console.log('📋 OAuth callback params:', { 
      hasCode: !!code, 
      codeLength: code?.length || 0,
      error: error || 'none',
      url: request.url 
    });

    if (error) {
      console.error('❌ OAuth error received:', error);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/settings?error=oauth_error&message=${encodeURIComponent(error)}`
      );
    }

    if (!code) {
      console.error('❌ No authorization code provided');
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/settings?error=missing_code`
      );
    }

    // Get user email from session/auth
    console.log('🔍 Getting authenticated user email...');
    const userEmail = await getAuthenticatedUserEmail(request);
    console.log('👤 Authenticated user:', userEmail ? `${userEmail}` : 'NOT AUTHENTICATED');
    
    if (!userEmail) {
      console.error('❌ User not authenticated - redirecting to login');
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/login?error=not_authenticated`
      );
    }

    // Exchange code for tokens
    console.log('🔑 Exchanging authorization code for tokens...');
    let credentials;
    try {
      credentials = await googleTasksIntegration.exchangeCodeForTokens(code);
      console.log('✅ Got credentials:', {
        hasAccessToken: !!credentials.accessToken,
        hasRefreshToken: !!credentials.refreshToken,
        expiryDate: credentials.expiryDate ? new Date(credentials.expiryDate).toISOString() : 'none'
      });
    } catch (tokenError) {
      console.error('❌ Token exchange failed:', tokenError);
      const errorMessage = tokenError instanceof Error ? tokenError.message : String(tokenError);
      console.log('📤 Redirecting with token exchange error:', errorMessage);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/settings?error=token_exchange_error&message=${encodeURIComponent(errorMessage)}`
      );
    }

    // Apply tokens to the service instance so subsequent API calls use them
    console.log('🔧 Setting credentials on service instance...');
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (googleTasksIntegration as any).setCredentialsFromTokens?.(credentials);
      console.log('✅ Credentials set successfully');
    } catch (e) {
      console.error('⚠️ Failed to set credentials on googleTasksIntegration instance:', e);
    }

    // Get task lists to verify connection and set default
    console.log('📝 Fetching Google task lists to verify connection...');
    let taskLists;
    try {
      // First try using the new direct method
      taskLists = await googleTasksIntegration.getTaskListsWithCredentials(credentials);
      console.log('✅ Got task lists using direct method:', taskLists.length, 'lists found');
      console.log('📋 Task lists:', taskLists.map(list => ({ id: list.id, title: list.title })));
    } catch (directError) {
      console.error('❌ Direct method failed, trying fallback:', directError);
      try {
        // Fallback to the original method
        taskLists = await googleTasksIntegration.getTaskLists(userEmail);
        console.log('✅ Got task lists using fallback method:', taskLists.length, 'lists found');
      } catch (fallbackError) {
        console.error('❌ Fallback method also failed:', fallbackError);
        // Last resort: use direct googleapis call
        try {
          taskLists = await getTaskListsDirectly(credentials);
          console.log('✅ Got task lists using direct googleapis:', taskLists.length, 'lists found');
        } catch (lastResortError) {
          console.error('❌ All methods failed:', lastResortError);
          throw new Error(`Failed to fetch task lists: ${lastResortError instanceof Error ? lastResortError.message : String(lastResortError)}`);
        }
      }
    }
    
    const defaultTaskList = taskLists.find((list: any) => list.title === '@default' || list.id === '@default') || taskLists[0];

    // Save Google Tasks settings
    console.log('💾 Saving Google Tasks settings to Firestore...');
    const settingsToSave = {
      isConnected: true,
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      tokenExpiresAt: credentials.expiryDate,
      userEmail,
      defaultTaskListId: defaultTaskList?.id || '@default',
      syncEnabled: true,
      syncDirection: 'bidirectional' as const,
      autoSync: true,
      syncInterval: 15, // 15 minutes
      syncStatus: 'success' as const,
      connectedAt: Date.now(),
      lastSyncAt: Date.now(),
      onDeletedTasksAction: 'skip' as const // Default to skip when first connecting
    };
    
    console.log('📄 Settings to save:', {
      ...settingsToSave,
      accessToken: settingsToSave.accessToken ? `${settingsToSave.accessToken.substring(0, 10)}...` : 'none',
      refreshToken: settingsToSave.refreshToken ? `${settingsToSave.refreshToken.substring(0, 10)}...` : 'none'
    });

    await googleTasksService.updateGoogleTasksSettings(userEmail, settingsToSave);
    console.log('✅ Settings saved successfully');

    console.log('🎉 OAuth callback completed successfully - redirecting to settings');
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/settings?success=google_tasks_connected`
    );
  } catch (error) {
    console.error('💥 Error handling OAuth callback:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log('📤 Redirecting with error:', errorMessage);
    
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/settings?error=callback_error&message=${encodeURIComponent(errorMessage)}`
    );
  }
}

// (auth helper imported from src/lib/auth-utils)
