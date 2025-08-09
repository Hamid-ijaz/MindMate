import { NextRequest, NextResponse } from 'next/server';
import { googleCalendarService } from '@/lib/firestore';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('mindmate-auth')?.value; // Fix: use correct cookie name
    
    if (!userEmail) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    await googleCalendarService.disconnectGoogleCalendar(userEmail);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Google Calendar:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
