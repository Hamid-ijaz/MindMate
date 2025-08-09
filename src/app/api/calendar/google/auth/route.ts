import { NextRequest, NextResponse } from 'next/server';
import { GoogleCalendarService } from '@/lib/calendar-sync/google-calendar';

const googleCalendarService = new GoogleCalendarService(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  process.env.GOOGLE_REDIRECT_URI!
);

export async function GET() {
  try {
    const authUrl = googleCalendarService.getAuthUrl();
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error generating Google Calendar auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}
