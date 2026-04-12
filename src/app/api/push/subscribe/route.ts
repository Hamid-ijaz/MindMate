import { NextRequest, NextResponse } from 'next/server';
import type { Prisma, PushSubscription as PrismaPushSubscription } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserEmail, isAuthorizedCronRequest } from '@/lib/auth-utils';

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId?: string;
  userEmail?: string;
  deviceInfo?: {
    userAgent?: string;
    platform?: string;
    vendor?: string;
    [key: string]: unknown;
  };
  subscribedAt?: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const sanitizeJsonValue = (value: unknown): unknown => {
  if (value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, nestedValue]) => nestedValue !== undefined)
        .map(([key, nestedValue]) => [key, sanitizeJsonValue(nestedValue)])
    );
  }

  return value;
};

const toOptionalDate = (value?: number): Date | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const toApiSubscription = (subscription: PrismaPushSubscription) => ({
  ...subscription,
  userId: subscription.userEmail,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as PushSubscriptionData;
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    const isCronRequest = isAuthorizedCronRequest(request);

    if (!isCronRequest && !authenticatedUserEmail) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    // Validate required fields
    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json(
        { error: 'Missing required subscription data' },
        { status: 400 }
      );
    }

    const targetUserEmail = body.userEmail || body.userId;
    if (!targetUserEmail) {
      return NextResponse.json(
        { error: 'Missing required user identity' },
        { status: 400 }
      );
    }

    if (!isCronRequest && authenticatedUserEmail !== targetUserEmail) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const serializedKeys = sanitizeJsonValue(body.keys) as Prisma.InputJsonValue;
    const serializedSubscription = sanitizeJsonValue({
      endpoint: body.endpoint,
      keys: body.keys,
    }) as Prisma.InputJsonValue;
    const serializedDeviceInfo = body.deviceInfo
      ? (sanitizeJsonValue(body.deviceInfo) as Prisma.InputJsonValue)
      : undefined;
    const subscribedAt = toOptionalDate(body.subscribedAt);

    const existingSubscription = await prisma.pushSubscription.findUnique({
      where: { endpoint: body.endpoint },
      select: { id: true },
    });

    if (existingSubscription) {
      const updateData: Prisma.PushSubscriptionUncheckedUpdateInput = {
        keys: serializedKeys,
        userEmail: targetUserEmail,
        deviceInfo: serializedDeviceInfo,
        isActive: true,
        subscription: serializedSubscription,
        lastUsedAt: new Date(),
        unsubscribedAt: null,
        deactivatedAt: null,
        deactivationReason: null,
      };

      await prisma.pushSubscription.update({
        where: { id: existingSubscription.id },
        data: updateData,
      });

      return NextResponse.json({
        success: true,
        message: 'Subscription updated successfully',
        id: existingSubscription.id,
      });
    } else {
      const createData: Prisma.PushSubscriptionUncheckedCreateInput = {
        endpoint: body.endpoint,
        keys: serializedKeys,
        userEmail: targetUserEmail,
        isActive: true,
        lastUsedAt: new Date(),
        subscription: serializedSubscription,
        ...(serializedDeviceInfo !== undefined ? { deviceInfo: serializedDeviceInfo } : {}),
        ...(subscribedAt !== undefined ? { subscribedAt } : {}),
      };

      const createdSubscription = await prisma.pushSubscription.create({
        data: createData,
        select: { id: true },
      });

      return NextResponse.json({
        success: true,
        message: 'Subscription saved successfully',
        id: createdSubscription.id,
      });
    }
  } catch (error) {
    console.error('Error saving push subscription:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to save subscription',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    const isCronRequest = isAuthorizedCronRequest(request);

    if (!isCronRequest && !authenticatedUserEmail) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'UserId is required' },
        { status: 400 }
      );
    }

    if (!isCronRequest && authenticatedUserEmail !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        userEmail: userId,
        isActive: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      subscriptions: subscriptions.map(toApiSubscription),
    });
  } catch (error) {
    console.error('Error fetching push subscriptions:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch subscriptions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
