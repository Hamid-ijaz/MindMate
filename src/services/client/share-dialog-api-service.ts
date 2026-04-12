import type {
  ShareAnalytics,
  SharePermission,
  SharedItem,
} from '@/lib/types';
import { requestJson } from '@/lib/client-api';

type ShareSettingsUpdate = Partial<
  Pick<SharedItem, 'allowComments' | 'allowDownload' | 'expiresAt'>
>;

const request = requestJson;

const toSettingsPayload = (settings: ShareSettingsUpdate): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};

  if ('allowComments' in settings) {
    payload.allowComments = settings.allowComments;
  }

  if ('allowDownload' in settings) {
    payload.allowDownload = settings.allowDownload;
  }

  if ('expiresAt' in settings) {
    payload.expiresAt = settings.expiresAt ?? null;
  }

  return payload;
};

export const shareDialogApiService = {
  async getSharedItemsByOwner(): Promise<SharedItem[]> {
    const result = await request<{ items: SharedItem[] }>('/api/share/owner');

    return result.items;
  },

  async createOrGetShareLink(
    itemId: string,
    itemType: 'task' | 'note',
    permission: SharePermission
  ): Promise<{ shareToken: string; url: string; isNew: boolean }> {
    return request<{ shareToken: string; url: string; isNew: boolean }>(
      '/api/share/owner',
      {
        method: 'POST',
        body: JSON.stringify({
          itemId,
          itemType,
          permission,
        }),
      }
    );
  },

  async getShareAnalytics(token: string): Promise<ShareAnalytics> {
    return request<ShareAnalytics>(
      `/api/share/token/${encodeURIComponent(token)}/analytics`
    );
  },

  async addCollaborator(
    token: string,
    collaboratorEmail: string,
    permission: SharePermission
  ): Promise<void> {
    await request<{ success: true }>(
      `/api/share/token/${encodeURIComponent(token)}/collaborators`,
      {
        method: 'POST',
        body: JSON.stringify({
          collaboratorEmail,
          permission,
        }),
      }
    );
  },

  async removeCollaborator(
    token: string,
    collaboratorEmail: string
  ): Promise<void> {
    await request<{ success: true }>(
      `/api/share/token/${encodeURIComponent(token)}/collaborators`,
      {
        method: 'DELETE',
        body: JSON.stringify({
          collaboratorEmail,
        }),
      }
    );
  },

  async updateSharePermission(
    token: string,
    permission: SharePermission
  ): Promise<void> {
    await request<{ success: true }>(
      `/api/share/token/${encodeURIComponent(token)}/permission`,
      {
        method: 'PATCH',
        body: JSON.stringify({ permission }),
      }
    );
  },

  async regenerateShareToken(token: string): Promise<string> {
    const result = await request<{ shareToken: string }>(
      `/api/share/token/${encodeURIComponent(token)}/regenerate`,
      {
        method: 'POST',
      }
    );

    return result.shareToken;
  },

  async revokeShareAccess(token: string): Promise<void> {
    await request<{ success: true }>(
      `/api/share/token/${encodeURIComponent(token)}/revoke`,
      {
        method: 'POST',
      }
    );
  },

  async updateShareSettings(
    token: string,
    settings: ShareSettingsUpdate
  ): Promise<void> {
    await request<{ success: true }>(
      `/api/share/token/${encodeURIComponent(token)}/settings`,
      {
        method: 'PATCH',
        body: JSON.stringify(toSettingsPayload(settings)),
      }
    );
  },

  async userExists(email: string): Promise<boolean> {
    const result = await request<{ exists: boolean }>(
      `/api/users/exists?email=${encodeURIComponent(email)}`
    );

    return result.exists;
  },
};
