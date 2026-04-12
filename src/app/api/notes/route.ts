import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import { notePrismaService } from '@/services/server/note-prisma-service';

type CreateNoteBody = {
  userEmail?: string;
  note?: {
    title?: string;
    content?: string;
    imageUrl?: string | null;
    audioUrl?: string | null;
    color?: string;
    fontSize?: number;
    isArchived?: boolean;
  };
  title?: string;
  content?: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
  color?: string;
  fontSize?: number;
  isArchived?: boolean;
};

export async function GET(request: NextRequest) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');

    if (!userEmail) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 });
    }

    if (authenticatedUserEmail !== userEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const notes = await notePrismaService.listNotes(userEmail);
    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Error fetching notes:', error);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json()) as CreateNoteBody;
    const userEmail = body.userEmail;

    if (!userEmail) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 });
    }

    if (authenticatedUserEmail !== userEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const noteInput = body.note ?? body;
    const title = noteInput.title;
    const content = noteInput.content;

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const noteId = await notePrismaService.createNote(userEmail, {
      title,
      content,
      imageUrl: noteInput.imageUrl,
      audioUrl: noteInput.audioUrl,
      color: noteInput.color,
      fontSize: noteInput.fontSize,
      isArchived: noteInput.isArchived,
    });

    return NextResponse.json({ noteId, success: true });
  } catch (error) {
    console.error('Error creating note:', error);
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}