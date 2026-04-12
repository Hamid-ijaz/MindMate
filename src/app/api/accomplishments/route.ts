import { NextRequest, NextResponse } from 'next/server';
import { accomplishmentPrismaService } from '@/services/server/accomplishment-prisma-service';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');

    if (!userEmail) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 });
    }

    if (authenticatedUserEmail !== userEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const accomplishments = await accomplishmentPrismaService.getAccomplishments(userEmail);
    return NextResponse.json({ accomplishments });
  } catch (error) {
    console.error('Error fetching accomplishments:', error);
    return NextResponse.json({ error: 'Failed to fetch accomplishments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const userEmail = body?.userEmail;
    const date = body?.accomplishment?.date ?? body?.date;
    const content = body?.accomplishment?.content ?? body?.content;

    if (!userEmail || !date || !content) {
      return NextResponse.json(
        { error: 'User email, date, and content are required' },
        { status: 400 }
      );
    }

    if (authenticatedUserEmail !== userEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const accomplishmentId = await accomplishmentPrismaService.addAccomplishment(userEmail, {
      date,
      content,
    });

    return NextResponse.json({ accomplishmentId });
  } catch (error) {
    console.error('Error creating accomplishment:', error);
    return NextResponse.json({ error: 'Failed to create accomplishment' }, { status: 500 });
  }
}