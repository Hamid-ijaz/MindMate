import { NextRequest, NextResponse } from 'next/server';
import type { ChatMessage } from '@/lib/types';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';
import {
  chatPrismaService,
  ChatSessionNotFoundError,
} from '@/services/server/chat-prisma-service';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type CreateMessageBody = {
  message?: unknown;
};

const getSessionId = async (context: RouteContext): Promise<string> => {
  const { id } = await context.params;
  return id;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const normalizeMessage = (value: unknown): Omit<ChatMessage, 'id'> | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (value.role !== 'user' && value.role !== 'assistant') {
    return null;
  }

  if (typeof value.content !== 'string') {
    return null;
  }

  return {
    role: value.role,
    content: value.content,
    timestamp:
      typeof value.timestamp === 'number' && Number.isFinite(value.timestamp)
        ? value.timestamp
        : Date.now(),
    suggestedTasks: value.suggestedTasks as ChatMessage['suggestedTasks'],
    quickActions: value.quickActions as ChatMessage['quickActions'],
    taskReferences: value.taskReferences as ChatMessage['taskReferences'],
    metadata: value.metadata as ChatMessage['metadata'],
  };
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const sessionId = await getSessionId(context);
    const beforeTimestampRaw = new URL(request.url).searchParams.get('beforeTimestamp');
    const parsedBeforeTimestamp = beforeTimestampRaw ? Number(beforeTimestampRaw) : undefined;
    const beforeTimestamp =
      typeof parsedBeforeTimestamp === 'number' && Number.isFinite(parsedBeforeTimestamp)
        ? parsedBeforeTimestamp
        : undefined;

    const result = await chatPrismaService.getSessionMessages(
      authenticatedUserEmail,
      sessionId,
      beforeTimestamp
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ChatSessionNotFoundError) {
      return NextResponse.json({ error: 'Chat session not found' }, { status: 404 });
    }

    console.error('Error fetching chat messages:', error);
    return NextResponse.json({ error: 'Failed to fetch chat messages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const sessionId = await getSessionId(context);
    const body = (await request.json().catch(() => ({}))) as CreateMessageBody;
    const message = normalizeMessage(body.message);

    if (!message) {
      return NextResponse.json({ error: 'Message payload is required' }, { status: 400 });
    }

    const messageId = await chatPrismaService.addMessage(
      authenticatedUserEmail,
      sessionId,
      message
    );

    return NextResponse.json({ success: true, messageId });
  } catch (error) {
    if (error instanceof ChatSessionNotFoundError) {
      return NextResponse.json({ error: 'Chat session not found' }, { status: 404 });
    }

    console.error('Error creating chat message:', error);
    return NextResponse.json({ error: 'Failed to create chat message' }, { status: 500 });
  }
}
