import type { Accomplishment } from '@/lib/types';
import { requestJson } from '@/lib/client-api';

const request = requestJson;

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
