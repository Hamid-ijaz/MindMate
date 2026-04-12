import { Note as PrismaNote, Prisma } from '@prisma/client';
import type { Note } from '@/lib/types';
import { prisma } from '@/lib/prisma';

type NoteCreateInput = Omit<Note, 'id' | 'userEmail' | 'createdAt' | 'updatedAt'>;
type NoteUpdateInput = Partial<
  Omit<Note, 'id' | 'userEmail' | 'createdAt' | 'updatedAt'>
>;

const toNote = (note: PrismaNote): Note => {
  return {
    id: note.id,
    userEmail: note.userEmail,
    title: note.title,
    content: note.content,
    imageUrl: note.imageUrl,
    audioUrl: note.audioUrl,
    color: note.color ?? undefined,
    fontSize: note.fontSize ?? undefined,
    isArchived: note.isArchived,
    createdAt: note.createdAt.getTime(),
    updatedAt: note.updatedAt.getTime(),
  };
};

const toCreateData = (
  userEmail: string,
  note: NoteCreateInput
): Prisma.NoteUncheckedCreateInput => {
  return {
    userEmail,
    title: note.title,
    content: note.content,
    imageUrl: note.imageUrl,
    audioUrl: note.audioUrl,
    color: note.color,
    fontSize: note.fontSize,
    isArchived: note.isArchived ?? false,
  };
};

const toUpdateData = (updates: NoteUpdateInput): Prisma.NoteUpdateManyMutationInput => {
  const data: Prisma.NoteUpdateManyMutationInput = {};

  if (updates.title !== undefined) {
    data.title = updates.title;
  }
  if (updates.content !== undefined) {
    data.content = updates.content;
  }
  if (updates.imageUrl !== undefined) {
    data.imageUrl = updates.imageUrl;
  }
  if (updates.audioUrl !== undefined) {
    data.audioUrl = updates.audioUrl;
  }
  if (updates.color !== undefined) {
    data.color = updates.color;
  }
  if (updates.fontSize !== undefined) {
    data.fontSize = updates.fontSize;
  }
  if (updates.isArchived !== undefined) {
    data.isArchived = updates.isArchived;
  }

  return data;
};

export const notePrismaService = {
  async listNotes(userEmail: string): Promise<Note[]> {
    const notes = await prisma.note.findMany({
      where: { userEmail },
      orderBy: { updatedAt: 'desc' },
    });

    return notes.map(toNote);
  },

  async getNote(noteId: string, userEmail: string): Promise<Note | null> {
    const note = await prisma.note.findFirst({
      where: {
        id: noteId,
        userEmail,
      },
    });

    return note ? toNote(note) : null;
  },

  async createNote(userEmail: string, note: NoteCreateInput): Promise<string> {
    const createdNote = await prisma.note.create({
      data: toCreateData(userEmail, note),
      select: { id: true },
    });

    return createdNote.id;
  },

  async updateNote(
    noteId: string,
    userEmail: string,
    updates: NoteUpdateInput
  ): Promise<Note | null> {
    const updateData = toUpdateData(updates);

    if (Object.keys(updateData).length === 0) {
      return this.getNote(noteId, userEmail);
    }

    const updated = await prisma.note.updateMany({
      where: {
        id: noteId,
        userEmail,
      },
      data: updateData,
    });

    if (updated.count === 0) {
      return null;
    }

    const note = await prisma.note.findUnique({ where: { id: noteId } });
    return note ? toNote(note) : null;
  },

  async deleteNote(noteId: string, userEmail: string): Promise<boolean> {
    const deleted = await prisma.note.deleteMany({
      where: {
        id: noteId,
        userEmail,
      },
    });

    return deleted.count > 0;
  },

  async searchNotes(userEmail: string, query: string): Promise<Note[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return [];
    }

    const notes = await prisma.note.findMany({
      where: {
        userEmail,
        OR: [
          {
            title: {
              contains: normalizedQuery,
              mode: 'insensitive',
            },
          },
          {
            content: {
              contains: normalizedQuery,
              mode: 'insensitive',
            },
          },
        ],
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return notes.map(toNote);
  },
};