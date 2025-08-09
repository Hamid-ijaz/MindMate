import { NextRequest, NextResponse } from 'next/server';
import { GoogleCalendarService } from '@/lib/calendar-sync/google-calendar';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL(`/settings?error=google_auth_cancelled&message=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/settings?error=google_auth_failed&message=No authorization code received', request.url)
      );
    }

    // Initialize the Google Calendar service
    const googleService = new GoogleCalendarService(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      process.env.GOOGLE_REDIRECT_URI!
    );

    // Exchange code for tokens
    const tokens = await googleService.exchangeCodeForTokens(code);

    // Get user info
    googleService.setTokens(tokens.accessToken, tokens.refreshToken);
    const userInfo = await googleService.getUserInfo();
    console.log("🚀 > GET > userInfo:", userInfo)

    // Store the tokens securely (you'll need to implement this based on your auth system)
    // For now, we'll pass them as query parameters (not secure for production)
    const redirectUrl = new URL('/settings', request.url);
    redirectUrl.searchParams.set('google_connected', 'true');
    redirectUrl.searchParams.set('google_email', userInfo.email);
    
    // In production, store these in your database associated with the user
    // redirectUrl.searchParams.set('access_token', tokens.accessToken);
    // redirectUrl.searchParams.set('refresh_token', tokens.refreshToken);

    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(
      new URL(`/settings?error=google_auth_failed&message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, request.url)
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'authorize': {
        const googleService = new GoogleCalendarService(
          process.env.GOOGLE_CLIENT_ID!,
          process.env.GOOGLE_CLIENT_SECRET!,
          process.env.GOOGLE_REDIRECT_URI!
        );

        const authUrl = googleService.getAuthUrl();
        return NextResponse.json({ authUrl });
      }

      case 'disconnect': {
        // Handle disconnecting Google Calendar
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
    console.error('Google Calendar API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
