import {
  ChatMessage as PrismaChatMessage,
  ChatRole,
  ChatSession as PrismaChatSession,
  Prisma,
} from '@prisma/client';
import type { ChatMessage, ChatSession } from '@/lib/types';
import { prisma } from '@/lib/prisma';

const DEFAULT_SESSION_TITLE = 'New Chat';

export class ChatSessionNotFoundError extends Error {
  constructor() {
    super('Chat session not found');
    this.name = 'ChatSessionNotFoundError';
  }
}

const toClientRole = (role: ChatRole): ChatMessage['role'] => {
  if (role === ChatRole.user) {
    return 'user';
  }

  return 'assistant';
};

const toSessionContext = (
  value: Prisma.JsonValue | null
): ChatSession['context'] | undefined => {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return undefined;
  }

  return value as ChatSession['context'];
};

const toNullableArrayField = <T>(
  value: Prisma.JsonValue | null
): T[] | null | undefined => {
  if (value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value as T[];
  }

  return undefined;
};

const toMetadata = (
  value: Prisma.JsonValue | null
): ChatMessage['metadata'] | undefined => {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return undefined;
  }

  return value as ChatMessage['metadata'];
};

const toJsonValue = (
  value: unknown
): Prisma.InputJsonValue | Prisma.NullTypes.JsonNull | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
};

const toTimestampDate = (value?: number): Date => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value);
  }

  return new Date();
};

const toChatSession = (session: PrismaChatSession): ChatSession => {
  return {
    id: session.id,
    userEmail: session.userEmail,
    title: session.title,
    createdAt: session.createdAt.getTime(),
    updatedAt: session.updatedAt.getTime(),
    messageCount: session.messageCount,
    lastMessage: session.lastMessage ?? undefined,
    isActive: session.isActive,
    context: toSessionContext(session.context),
  };
};

const toChatMessage = (message: PrismaChatMessage): ChatMessage => {
  return {
    id: message.id,
    role: toClientRole(message.role),
    content: message.content,
    timestamp: message.timestamp.getTime(),
    suggestedTasks: toNullableArrayField(message.suggestedTasks),
    quickActions: toNullableArrayField(message.quickActions),
    taskReferences: toNullableArrayField(message.taskReferences),
    metadata: toMetadata(message.metadata),
  };
};

const toMessageCreateData = (
  sessionId: string,
  message: Omit<ChatMessage, 'id'>
): Prisma.ChatMessageUncheckedCreateInput => {
  return {
    sessionId,
    role: message.role === 'user' ? ChatRole.user : ChatRole.assistant,
    content: message.content,
    timestamp: toTimestampDate(message.timestamp),
    suggestedTasks: toJsonValue(message.suggestedTasks),
    quickActions: toJsonValue(message.quickActions),
    taskReferences: toJsonValue(message.taskReferences),
    metadata: toJsonValue(message.metadata),
  };
};

const requireOwnedSession = async (
  userEmail: string,
  sessionId: string
): Promise<void> => {
  const session = await prisma.chatSession.findFirst({
    where: {
      id: sessionId,
      userEmail,
    },
    select: { id: true },
  });

  if (!session) {
    throw new ChatSessionNotFoundError();
  }
};

export const chatPrismaService = {
  async createChatSession(userEmail: string, title?: string): Promise<string> {
    const createdSession = await prisma.chatSession.create({
      data: {
        userEmail,
        title: title || DEFAULT_SESSION_TITLE,
        isActive: true,
      },
      select: { id: true },
    });

    return createdSession.id;
  },

  async getChatSessions(userEmail: string): Promise<ChatSession[]> {
    const sessions = await prisma.chatSession.findMany({
      where: { userEmail },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    return sessions.map(toChatSession);
  },

  async getSession(userEmail: string, sessionId: string): Promise<ChatSession | null> {
    const session = await prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userEmail,
      },
    });

    return session ? toChatSession(session) : null;
  },

  async getActiveSession(userEmail: string): Promise<ChatSession | null> {
    const session = await prisma.chatSession.findFirst({
      where: {
        userEmail,
        isActive: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return session ? toChatSession(session) : null;
  },

  async addMessage(
    userEmail: string,
    sessionId: string,
    message: Omit<ChatMessage, 'id'>
  ): Promise<string> {
    return prisma.$transaction(async (tx) => {
      const session = await tx.chatSession.findFirst({
        where: {
          id: sessionId,
          userEmail,
        },
        select: { id: true },
      });

      if (!session) {
        throw new ChatSessionNotFoundError();
      }

      const createdMessage = await tx.chatMessage.create({
        data: toMessageCreateData(sessionId, message),
        select: { id: true },
      });

      await tx.chatSession.update({
        where: { id: sessionId },
        data: {
          updatedAt: new Date(),
          messageCount: { increment: 1 },
          lastMessage: message.content.substring(0, 100),
        },
      });

      return createdMessage.id;
    });
  },

  async getSessionMessages(
    userEmail: string,
    sessionId: string,
    beforeTimestamp?: number
  ): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
    await requireOwnedSession(userEmail, sessionId);

    const where: Prisma.ChatMessageWhereInput = {
      sessionId,
    };

    if (typeof beforeTimestamp === 'number' && Number.isFinite(beforeTimestamp)) {
      where.timestamp = {
        lt: new Date(beforeTimestamp),
      };
    }

    const messages = await prisma.chatMessage.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    return {
      messages: messages.map(toChatMessage).reverse(),
      hasMore: messages.length === 50,
    };
  },

  async updateSessionTitle(
    userEmail: string,
    sessionId: string,
    title: string
  ): Promise<boolean> {
    const updated = await prisma.chatSession.updateMany({
      where: {
        id: sessionId,
        userEmail,
      },
      data: {
        title,
        updatedAt: new Date(),
      },
    });

    return updated.count > 0;
  },

  async deleteSession(userEmail: string, sessionId: string): Promise<boolean> {
    const deleted = await prisma.chatSession.deleteMany({
      where: {
        id: sessionId,
        userEmail,
      },
    });

    return deleted.count > 0;
  },

  async setSessionActive(
    userEmail: string,
    sessionId: string,
    isActive: boolean
  ): Promise<boolean> {
    const updated = await prisma.chatSession.updateMany({
      where: {
        id: sessionId,
        userEmail,
      },
      data: {
        isActive,
        updatedAt: new Date(),
      },
    });

    return updated.count > 0;
  },
};
