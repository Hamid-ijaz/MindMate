import type { ChatMessage, ChatSession } from '@/lib/types';

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

export const chatApiService = {
  async createChatSession(userEmail: string, title?: string): Promise<string> {
    const result = await request<{ sessionId: string }>(`/api/chat/sessions`, {
      method: 'POST',
      body: JSON.stringify({
        userEmail,
        title,
      }),
    });

    return result.sessionId;
  },

  async getChatSessions(userEmail: string): Promise<ChatSession[]> {
    const result = await request<{ sessions: ChatSession[] }>(
      `/api/chat/sessions?userEmail=${encodeURIComponent(userEmail)}`
    );

    return result.sessions;
  },

  async getActiveSession(userEmail: string): Promise<ChatSession | null> {
    const result = await request<{ session: ChatSession | null }>(
      `/api/chat/sessions?active=true&userEmail=${encodeURIComponent(userEmail)}`
    );

    return result.session;
  },

  async addMessage(sessionId: string, message: Omit<ChatMessage, 'id'>): Promise<string> {
    const result = await request<{ messageId: string }>(
      `/api/chat/sessions/${encodeURIComponent(sessionId)}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ message }),
      }
    );

    return result.messageId;
  },

  async getSessionMessages(
    sessionId: string,
    beforeTimestamp?: number
  ): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
    const search = new URLSearchParams();
    if (typeof beforeTimestamp === 'number' && Number.isFinite(beforeTimestamp)) {
      search.set('beforeTimestamp', String(beforeTimestamp));
    }

    const suffix = search.toString();
    const result = await request<{ messages: ChatMessage[]; hasMore: boolean }>(
      `/api/chat/sessions/${encodeURIComponent(sessionId)}/messages${suffix ? `?${suffix}` : ''}`
    );

    return {
      messages: result.messages,
      hasMore: result.hasMore,
    };
  },

  async deleteSession(sessionId: string): Promise<void> {
    await request<{ success: true }>(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
  },

  async setSessionActive(sessionId: string, isActive: boolean): Promise<void> {
    await request<{ success: true }>(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  },

  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    await request<{ success: true }>(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });
  },
};
