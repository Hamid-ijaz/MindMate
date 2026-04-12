import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import { chatPrismaService } from '@/services/server/chat-prisma-service';

type CreateSessionBody = {
  userEmail?: string;
  title?: string;
};

export async function GET(request: NextRequest) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedUserEmail = searchParams.get('userEmail');
    const userEmail = requestedUserEmail ?? authenticatedUserEmail;

    if (userEmail !== authenticatedUserEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const activeOnly = searchParams.get('active') === 'true';

    if (activeOnly) {
      const session = await chatPrismaService.getActiveSession(userEmail);
      return NextResponse.json({ session });
    }

    const sessions = await chatPrismaService.getChatSessions(userEmail);
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch chat sessions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as CreateSessionBody;
    const requestedUserEmail =
      typeof body.userEmail === 'string' ? body.userEmail.trim() : undefined;
    const userEmail = requestedUserEmail || authenticatedUserEmail;

    if (userEmail !== authenticatedUserEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const title = typeof body.title === 'string' ? body.title : undefined;
    const sessionId = await chatPrismaService.createChatSession(userEmail, title);
    const session = await chatPrismaService.getSession(userEmail, sessionId);

    return NextResponse.json({ success: true, sessionId, session });
  } catch (error) {
    console.error('Error creating chat session:', error);
    return NextResponse.json({ error: 'Failed to create chat session' }, { status: 500 });
  }
}
