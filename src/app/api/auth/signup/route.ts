import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { setAuthCookie } from '@/lib/auth-utils';
import { userPrismaService } from '@/services/server/user-prisma-service';

type SignupInput = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dob?: string;
  password?: string;
};

type SignupBody = SignupInput & {
  userData?: SignupInput;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SignupBody;
    const input = body.userData ?? body;

    const firstName = input.firstName;
    const lastName = input.lastName;
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : undefined;

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: 'First name, last name, and email are required' },
        { status: 400 }
      );
    }

    const userExists = await userPrismaService.userExists(email);
    if (userExists) {
      return NextResponse.json({ success: false }, { status: 200 });
    }

    const user = await userPrismaService.createUser({
      firstName,
      lastName,
      email,
      phone: input.phone,
      dob: input.dob,
      password: input.password,
    });

    const response = NextResponse.json({ success: true, user });
    setAuthCookie(response, user.email);
    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ success: false }, { status: 200 });
    }

    console.error('Error during signup:', error);
    return NextResponse.json({ success: false, error: 'Failed to signup' }, { status: 500 });
  }
}
