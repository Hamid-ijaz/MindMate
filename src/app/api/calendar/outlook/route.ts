import { NextRequest, NextResponse } from 'next/server';
import { OutlookCalendarService } from '@/lib/calendar-sync/outlook-calendar';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      return NextResponse.redirect(
        new URL(`/settings?error=outlook_auth_cancelled&message=${encodeURIComponent(errorDescription || error)}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/settings?error=outlook_auth_failed&message=No authorization code received', request.url)
      );
    }

    // Initialize the Outlook Calendar service
    const outlookService = new OutlookCalendarService(
      process.env.OUTLOOK_CLIENT_ID!,
      process.env.OUTLOOK_CLIENT_SECRET!,
      process.env.OUTLOOK_REDIRECT_URI!
    );

    // Exchange code for tokens
    const tokens = await outlookService.exchangeCodeForTokens(code);

    // Get user info
    outlookService.setTokens(tokens.accessToken, tokens.refreshToken);
    const userInfo = await outlookService.getUserInfo();

    // Store the tokens securely (you'll need to implement this based on your auth system)
    // For now, we'll pass them as query parameters (not secure for production)
    const redirectUrl = new URL('/settings', request.url);
    redirectUrl.searchParams.set('outlook_connected', 'true');
    redirectUrl.searchParams.set('outlook_email', userInfo.mail || userInfo.userPrincipalName);
    
    // In production, store these in your database associated with the user
    // redirectUrl.searchParams.set('access_token', tokens.accessToken);
    // redirectUrl.searchParams.set('refresh_token', tokens.refreshToken);

    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error('Outlook OAuth callback error:', error);
    return NextResponse.redirect(
      new URL(`/settings?error=outlook_auth_failed&message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, request.url)
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'authorize': {
        const outlookService = new OutlookCalendarService(
          process.env.OUTLOOK_CLIENT_ID!,
          process.env.OUTLOOK_CLIENT_SECRET!,
          process.env.OUTLOOK_REDIRECT_URI!
        );

        const authUrl = outlookService.getAuthUrl();
        return NextResponse.json({ authUrl });
      }

      case 'disconnect': {
        // Handle disconnecting Outlook Calendar
        // You'll need to implement this based on your auth system
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Outlook Calendar API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
