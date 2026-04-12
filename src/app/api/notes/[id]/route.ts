import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import { notePrismaService } from '@/services/server/note-prisma-service';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UpdateNoteBody = {
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

const getIdFromParams = async (context: RouteContext): Promise<string> => {
  const { id } = await context.params;
  return id;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const noteId = await getIdFromParams(context);
    const note = await notePrismaService.getNote(noteId, authenticatedUserEmail);

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json({ note });
  } catch (error) {
    console.error('Error fetching note:', error);
    return NextResponse.json({ error: 'Failed to fetch note' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const noteId = await getIdFromParams(context);
    const body = (await request.json()) as UpdateNoteBody;
    const updates = body.note ?? body;

    const note = await notePrismaService.updateNote(noteId, authenticatedUserEmail, {
      title: updates.title,
      content: updates.content,
      imageUrl: updates.imageUrl,
      audioUrl: updates.audioUrl,
      color: updates.color,
      fontSize: updates.fontSize,
      isArchived: updates.isArchived,
    });

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json({ note, success: true });
  } catch (error) {
    console.error('Error updating note:', error);
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const noteId = await getIdFromParams(context);
    const deleted = await notePrismaService.deleteNote(noteId, authenticatedUserEmail);

    if (!deleted) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting note:', error);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}