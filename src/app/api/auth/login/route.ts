import { NextRequest, NextResponse } from 'next/server';
import { setAuthCookie } from '@/lib/auth-utils';
import { userPrismaService } from '@/services/server/user-prisma-service';

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LoginBody;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined;
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = await userPrismaService.validateCredentials(email, password);

    if (!user) {
      return NextResponse.json({ success: false }, { status: 200 });
    }

    const response = NextResponse.json({ success: true, user });
    setAuthCookie(response, user.email);
    return response;
  } catch (error) {
    console.error('Error during login:', error);
    return NextResponse.json({ success: false, error: 'Failed to login' }, { status: 500 });
  }
}
