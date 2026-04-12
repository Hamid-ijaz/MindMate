import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import { chatPrismaService } from '@/services/server/chat-prisma-service';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type PatchSessionBody = {
  title?: string;
  isActive?: boolean;
};

const getSessionId = async (context: RouteContext): Promise<string> => {
  const { id } = await context.params;
  return id;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const sessionId = await getSessionId(context);
    const session = await chatPrismaService.getSession(authenticatedUserEmail, sessionId);

    if (!session) {
      return NextResponse.json({ error: 'Chat session not found' }, { status: 404 });
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error('Error fetching chat session:', error);
    return NextResponse.json({ error: 'Failed to fetch chat session' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const sessionId = await getSessionId(context);
    const body = (await request.json().catch(() => ({}))) as PatchSessionBody;

    const shouldUpdateTitle = typeof body.title === 'string';
    const shouldUpdateActive = typeof body.isActive === 'boolean';

    if (!shouldUpdateTitle && !shouldUpdateActive) {
      return NextResponse.json(
        { error: 'Session updates are required' },
        { status: 400 }
      );
    }

    if (shouldUpdateTitle) {
      const updated = await chatPrismaService.updateSessionTitle(
        authenticatedUserEmail,
        sessionId,
        body.title as string
      );

      if (!updated) {
        return NextResponse.json({ error: 'Chat session not found' }, { status: 404 });
      }
    }

    if (shouldUpdateActive) {
      const updated = await chatPrismaService.setSessionActive(
        authenticatedUserEmail,
        sessionId,
        body.isActive as boolean
      );

      if (!updated) {
        return NextResponse.json({ error: 'Chat session not found' }, { status: 404 });
      }
    }

    const session = await chatPrismaService.getSession(authenticatedUserEmail, sessionId);

    return NextResponse.json({ success: true, session });
  } catch (error) {
    console.error('Error updating chat session:', error);
    return NextResponse.json({ error: 'Failed to update chat session' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const sessionId = await getSessionId(context);
    const deleted = await chatPrismaService.deleteSession(authenticatedUserEmail, sessionId);

    if (!deleted) {
      return NextResponse.json({ error: 'Chat session not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    console.error('Error deleting chat session:', error);
    return NextResponse.json({ error: 'Failed to delete chat session' }, { status: 500 });
  }
}
