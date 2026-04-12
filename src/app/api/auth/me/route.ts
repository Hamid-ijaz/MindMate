import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@/lib/types';
import {
  clearAuthCookie,
  getAuthenticatedUserEmail,
  setAuthCookie,
} from '@/lib/auth-utils';
import { userPrismaService } from '@/services/server/user-prisma-service';

type MeUpdateBody = {
  updates?: Partial<Pick<User, 'firstName' | 'lastName' | 'email' | 'phone' | 'dob'>>;
};

export async function GET(request: NextRequest) {
  try {
    const authenticatedEmail = await getAuthenticatedUserEmail(request);

    if (!authenticatedEmail) {
      const response = NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      clearAuthCookie(response);
      return response;
    }

    const user = await userPrismaService.getUser(authenticatedEmail);

    if (!user) {
      const response = NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      clearAuthCookie(response);
      return response;
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching current user:', error);
    return NextResponse.json({ error: 'Failed to fetch current user' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authenticatedEmail = await getAuthenticatedUserEmail(request);

    if (!authenticatedEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json()) as MeUpdateBody;
    const updates = body.updates;

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'Updates are required' }, { status: 400 });
    }

    const updatedUser = await userPrismaService.updateUser(authenticatedEmail, updates);

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const response = NextResponse.json({ success: true, user: updatedUser });

    if (updatedUser.email && updatedUser.email !== authenticatedEmail) {
      setAuthCookie(response, updatedUser.email);
    }

    return response;
  } catch (error) {
    console.error('Error updating current user:', error);
    return NextResponse.json({ error: 'Failed to update current user' }, { status: 500 });
  }
}
