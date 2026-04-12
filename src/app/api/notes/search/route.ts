import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import { notePrismaService } from '@/services/server/note-prisma-service';

export async function GET(request: NextRequest) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');
    const query = searchParams.get('query');

    if (!userEmail) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 });
    }

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    if (authenticatedUserEmail !== userEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const notes = await notePrismaService.searchNotes(userEmail, query);
    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Error searching notes:', error);
    return NextResponse.json({ error: 'Failed to search notes' }, { status: 500 });
  }
}