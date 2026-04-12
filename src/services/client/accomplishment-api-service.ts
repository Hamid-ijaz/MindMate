import type { Accomplishment } from '@/lib/types';

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

export const accomplishmentApiService = {
  async getAccomplishments(userEmail: string): Promise<Accomplishment[]> {
    const result = await request<{ accomplishments: Accomplishment[] }>(
      `/api/accomplishments?userEmail=${encodeURIComponent(userEmail)}`
    );

    return result.accomplishments;
  },

  async addAccomplishment(userEmail: string, accomplishment: Omit<Accomplishment, 'id'>): Promise<string> {
    const result = await request<{ accomplishmentId: string }>(`/api/accomplishments`, {
      method: 'POST',
      body: JSON.stringify({ userEmail, accomplishment }),
    });

    return result.accomplishmentId;
  },

  async deleteAccomplishment(userEmail: string, accomplishmentId: string): Promise<void> {
    await request<{ success: true }>(
      `/api/accomplishments/${encodeURIComponent(accomplishmentId)}?userEmail=${encodeURIComponent(userEmail)}`,
      {
        method: 'DELETE',
      }
    );
  },
};
