import type { Note } from '@/lib/types';

type ApiErrorPayload = {
  error?: string;
};

const request = async <T>(input: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as T & ApiErrorPayload;

  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with status ${response.status}`);
  }

  return payload;
};

const toPatchPayload = (updates: Partial<Omit<Note, 'id' | 'userEmail'>>) => {
  const nextUpdates: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      nextUpdates[key] = value;
    }
  }

  return nextUpdates;
};

export const noteApiService = {
  async getNotes(userEmail: string): Promise<Note[]> {
    const result = await request<{ notes: Note[] }>(
      `/api/notes?userEmail=${encodeURIComponent(userEmail)}`
    );

    return result.notes;
  },

  async addNote(
    userEmail: string,
    note: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'userEmail'>
  ): Promise<string> {
    const result = await request<{ noteId: string; success: true }>(`/api/notes`, {
      method: 'POST',
      body: JSON.stringify({
        userEmail,
        note,
      }),
    });

    return result.noteId;
  },

  async updateNote(
    noteId: string,
    updates: Partial<Omit<Note, 'id' | 'userEmail'>>
  ): Promise<void> {
    await request<{ success: true }>(`/api/notes/${encodeURIComponent(noteId)}`, {
      method: 'PATCH',
      body: JSON.stringify(toPatchPayload(updates)),
    });
  },

  async deleteNote(noteId: string): Promise<void> {
    await request<{ success: true }>(`/api/notes/${encodeURIComponent(noteId)}`, {
      method: 'DELETE',
    });
  },
};