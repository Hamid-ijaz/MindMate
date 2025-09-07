import { NextRequest, NextResponse } from 'next/server';
import { googleTasksIntegration } from '@/services/google-tasks';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getAuthenticatedUserEmail(request);
    if (!userEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const lists = await googleTasksIntegration.getTaskLists(userEmail);
    return NextResponse.json({ items: lists });
  } catch (error) {
    console.error('Error fetching Google task lists (API):', error);
    return NextResponse.json({ error: 'Failed to fetch task lists' }, { status: 500 });
  }
}
