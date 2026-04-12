import { NextRequest, NextResponse } from 'next/server';
import type { Prisma, PushSubscription as PrismaPushSubscription } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserEmail, isAuthorizedCronRequest } from '@/lib/auth-utils';

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

const toApiSubscription = (subscription: PrismaPushSubscription) => ({
  ...subscription,
  userId: subscription.userEmail,
});

export async function POST(request: NextRequest) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    const isCronRequest = isAuthorizedCronRequest(request);

    if (!isCronRequest && !authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
      userEmail?: string;
      deviceInfo?: Record<string, unknown>;
      preferences?: { enabled?: boolean; allowedTypes?: string[] };
    };
    const {
      endpoint,
      keys,
      userEmail,
      deviceInfo,
      preferences = { enabled: true, allowedTypes: ['reminders', 'overdue'] },
    } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth || !userEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: endpoint, keys, userEmail' },
        { status: 400 }
      );
    }

    if (!isCronRequest && authenticatedUserEmail !== userEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userAgent = isRecord(deviceInfo) && typeof deviceInfo.userAgent === 'string'
      ? deviceInfo.userAgent
      : undefined;
    const parsedUserAgent = getUserAgent(userAgent);
    const serializedKeys = sanitizeJsonValue(keys) as Prisma.InputJsonValue;
    const serializedSubscription = sanitizeJsonValue({ endpoint, keys }) as Prisma.InputJsonValue;
    const serializedDeviceInfo = sanitizeJsonValue({
      ...(isRecord(deviceInfo) ? deviceInfo : {}),
      browserName: parsedUserAgent?.browser?.name,
      browserVersion: parsedUserAgent?.browser?.version,
      deviceType: getDeviceType(userAgent),
    }) as Prisma.InputJsonValue;
    const serializedPreferences = sanitizeJsonValue(preferences) as Prisma.InputJsonValue;

    const existingSubscription = await prisma.pushSubscription.findUnique({
      where: { endpoint },
      select: { id: true },
    });

    if (existingSubscription) {
      const updateData: Prisma.PushSubscriptionUncheckedUpdateInput = {
        userEmail,
        keys: serializedKeys,
        isActive: true,
        lastUsedAt: new Date(),
        deviceInfo: serializedDeviceInfo,
        preferences: serializedPreferences,
        subscription: serializedSubscription,
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
        subscriptionId: existingSubscription.id,
      });
    }

    const createData: Prisma.PushSubscriptionUncheckedCreateInput = {
      userEmail,
      endpoint,
      keys: serializedKeys,
      isActive: true,
      subscribedAt: new Date(),
      lastUsedAt: new Date(),
      deviceInfo: serializedDeviceInfo,
      notificationStats: sanitizeJsonValue({
        totalSent: 0,
        totalDelivered: 0,
        failureCount: 0,
      }) as Prisma.InputJsonValue,
      preferences: serializedPreferences,
      subscription: serializedSubscription,
    };

    const createdSubscription = await prisma.pushSubscription.create({
      data: createData,
      select: { id: true },
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription created successfully',
      subscriptionId: createdSubscription.id,
    });

  } catch (error) {
    console.error('Error managing push subscription:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    const isCronRequest = isAuthorizedCronRequest(request);

    if (!isCronRequest && !authenticatedUserEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');
    const endpoint = searchParams.get('endpoint');

    if (!userEmail) {
      return NextResponse.json(
        { error: 'Missing required parameter: userEmail' },
        { status: 400 }
      );
    }

    if (!isCronRequest && authenticatedUserEmail !== userEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const where: Prisma.PushSubscriptionWhereInput = endpoint
      ? { userEmail, endpoint }
      : { userEmail };

    const result = await prisma.pushSubscription.updateMany({
      where,
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivationReason: 'user_unsubscribed',
        unsubscribedAt: new Date(),
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: 'No subscriptions found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Deactivated ${result.count} subscription(s)`,
      count: result.count,
    });

  } catch (error) {
    console.error('Error removing push subscriptions:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
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
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');

    if (!userEmail) {
      return NextResponse.json(
        { error: 'Missing required parameter: userEmail' },
        { status: 400 }
      );
    }

    if (!isCronRequest && authenticatedUserEmail !== userEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        userEmail,
        isActive: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const subscriptionData = subscriptions.map(toApiSubscription);

    return NextResponse.json({
      success: true,
      subscriptions: subscriptionData,
      count: subscriptionData.length,
    });

  } catch (error) {
    console.error('Error fetching push subscriptions:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Helper functions
function getUserAgent(userAgentString?: string) {
  if (!userAgentString) return null;
  
  // Simple user agent parsing - in production, consider using a library like ua-parser-js
  const isChrome = /Chrome/.test(userAgentString);
  const isFirefox = /Firefox/.test(userAgentString);
  const isSafari = /Safari/.test(userAgentString) && !isChrome;
  const isEdge = /Edg/.test(userAgentString);

  let browser = { name: 'unknown', version: 'unknown' };
  
  if (isChrome) {
    const version = userAgentString.match(/Chrome\/([0-9\.]+)/)?.[1];
    browser = { name: 'Chrome', version: version || 'unknown' };
  } else if (isFirefox) {
    const version = userAgentString.match(/Firefox\/([0-9\.]+)/)?.[1];
    browser = { name: 'Firefox', version: version || 'unknown' };
  } else if (isSafari) {
    const version = userAgentString.match(/Version\/([0-9\.]+)/)?.[1];
    browser = { name: 'Safari', version: version || 'unknown' };
  } else if (isEdge) {
    const version = userAgentString.match(/Edg\/([0-9\.]+)/)?.[1];
    browser = { name: 'Edge', version: version || 'unknown' };
  }

  return { browser };
}

function getDeviceType(userAgentString?: string): 'mobile' | 'tablet' | 'desktop' {
  if (!userAgentString) return 'desktop';
  
  const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgentString);
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(userAgentString);
  
  if (isTablet) return 'tablet';
  if (isMobile) return 'mobile';
  return 'desktop';
}
