import { NextRequest, NextResponse } from 'next/server';
import { GoogleCalendarService } from '@/lib/calendar-sync/google-calendar';
import { googleCalendarService } from '@/lib/firestore';
import { cookies } from 'next/headers';

const googleService = new GoogleCalendarService(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  process.env.GOOGLE_REDIRECT_URI!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    
    console.log('Google Calendar callback received:', { code: !!code, error, url: request.url });
    
    // Get user email from cookies
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('mindmate-auth')?.value;
    
    console.log('User email from cookie:', userEmail);
    
    if (!userEmail) {
      console.log('No user authentication found, redirecting to login');
      return NextResponse.redirect(new URL('/login?error=authentication_required', request.url));
    }

    if (error) {
      console.error('Google Calendar OAuth error:', error);
      return NextResponse.redirect(new URL('/settings?error=google_calendar_denied', request.url));
    }

    if (!code) {
      console.log('No authorization code received');
      return NextResponse.redirect(new URL('/settings?error=google_calendar_no_code', request.url));
    }

    // Exchange code for tokens
    const tokens = await googleService.exchangeCodeForTokens(code);
    
    // Set tokens in the service to get user info
    googleService.setTokens(tokens.accessToken, tokens.refreshToken, Date.now() + (tokens.expiresIn * 1000));
    
    // Get user's Google account info
    const userInfo = await googleService.getUserInfo();
    
    // Try to get user's calendars to set default - with error handling
    let primaryCalendar = null;
    try {
      const calendars = await googleService.getCalendarList();
      primaryCalendar = calendars.find(cal => cal.primary) || calendars[0];
    } catch (calendarError) {
      console.warn('Could not fetch calendar list, using primary calendar as default:', calendarError);
      // Continue with connection even if calendar list fails - use 'primary' as default
      primaryCalendar = { id: 'primary' };
    }

    // Save settings to Firestore
    const settingsToSave = {
      isConnected: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: Date.now() + (tokens.expiresIn * 1000),
      userEmail: userInfo.email,
      defaultCalendarId: primaryCalendar?.id || 'primary',
      syncEnabled: true,
      syncStatus: 'success' as const,
      lastSyncAt: Date.now(),
      connectedAt: Date.now(), // Add connectedAt timestamp
      lastError: undefined
    };
    
    console.log('Saving Google Calendar settings for user:', userEmail, settingsToSave);
    
    await googleCalendarService.updateGoogleCalendarSettings(userEmail, settingsToSave);
    
    console.log('Google Calendar settings saved successfully');

    return NextResponse.redirect(new URL('/settings?success=google_calendar_connected', request.url));
  } catch (error) {
    console.error('Google Calendar callback error:', error);
    
    // More specific error handling
    if (error instanceof Error) {
      const errorMessage = error.message;
      
      if (errorMessage.includes('Google Calendar API has not been used') || 
          errorMessage.includes('SERVICE_DISABLED') || 
          errorMessage.includes('accessNotConfigured')) {
        console.log('Google Calendar API is not enabled in Google Cloud Console');
        return NextResponse.redirect(new URL('/settings?error=google_calendar_api_disabled', request.url));
      }
      
      if (errorMessage.includes('PERMISSION_DENIED')) {
        return NextResponse.redirect(new URL('/settings?error=google_calendar_permission_denied', request.url));
      }
      
      if (errorMessage.includes('invalid_grant') || errorMessage.includes('token')) {
        return NextResponse.redirect(new URL('/settings?error=google_calendar_token_expired', request.url));
      }
    }
    
    return NextResponse.redirect(new URL('/settings?error=google_calendar_connection_failed', request.url));
  }
}
