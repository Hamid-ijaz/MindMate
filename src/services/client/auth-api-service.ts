import type { User } from '@/lib/types';
import { requestJson } from '@/lib/client-api';

type AuthUser = Pick<User, 'firstName' | 'lastName' | 'email' | 'phone' | 'dob'>;
export type SignupData = Pick<User, 'firstName' | 'lastName' | 'email'> &
  Partial<Pick<User, 'phone' | 'dob' | 'password'>>;

type LoginResponse = {
  success: boolean;
  user?: AuthUser;
};

type SignupResponse = {
  success: boolean;
  user?: AuthUser;
};

const request = requestJson;

export const authApiService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    return request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async signup(userData: SignupData): Promise<SignupResponse> {
    return request<SignupResponse>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ userData }),
    });
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const payload = (await response.json().catch(() => ({}))) as {
      user?: AuthUser;
      error?: string;
    };

    if (response.status === 401) {
      return null;
    }

    if (!response.ok) {
      throw new Error(payload.error ?? `Request failed with status ${response.status}`);
    }

    return payload.user ?? null;
  },

  async updateCurrentUser(updates: Partial<AuthUser>): Promise<AuthUser> {
    const result = await request<{ success: true; user: AuthUser }>('/api/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({ updates }),
    });

    return result.user;
  },

  async logout(): Promise<void> {
    await request<{ success: true }>('/api/auth/logout', {
      method: 'POST',
    });
  },
};
