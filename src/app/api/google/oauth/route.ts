import { NextRequest, NextResponse } from 'next/server';
import { googleTasksIntegration } from '@/services/google-tasks';

export async function GET() {
  try {
    const authUrl = googleTasksIntegration.getAuthUrl();
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    );
  }
}
