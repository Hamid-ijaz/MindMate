import { NextRequest, NextResponse } from 'next/server';
import { googleCalendarService } from '@/lib/firestore';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('mindmate-auth')?.value;
    
    console.log('Google Calendar settings request for user:', userEmail);
    
    if (!userEmail) {
      console.log('No user authentication found');
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    const settings = await googleCalendarService.getGoogleCalendarSettings(userEmail);
    
    console.log('Raw settings from database:', settings);
    
    // Transform the settings to match the frontend interface
    if (settings) {
      const transformedSettings = {
        connected: settings.isConnected || false,
        email: settings.userEmail || null,
        accessToken: settings.accessToken || null,
        refreshToken: settings.refreshToken || null,
        connectedAt: settings.connectedAt ? { seconds: Math.floor(settings.connectedAt / 1000) } : null,
        lastSync: settings.lastSyncAt ? { seconds: Math.floor(settings.lastSyncAt / 1000) } : null
      };
      console.log('Transformed settings:', transformedSettings);
      return NextResponse.json(transformedSettings);
    }
    
    console.log('No settings found, returning default');
    return NextResponse.json({
      connected: false,
      email: null,
      accessToken: null,
      refreshToken: null,
      connectedAt: null,
      lastSync: null
    });
  } catch (error) {
    console.error('Error fetching Google Calendar settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}
