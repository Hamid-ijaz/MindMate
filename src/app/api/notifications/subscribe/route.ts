import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserEmail } from '@/lib/auth-utils';

const toJson = (value: unknown): Prisma.InputJsonValue => {
  if (value === undefined || value === null) {
    return {};
  }

  try {
    const normalized = JSON.parse(JSON.stringify(value));
    return (normalized ?? {}) as Prisma.InputJsonValue;
  } catch {
    return {};
  }
};

export async function POST(request: NextRequest) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    if (!authenticatedUserEmail) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const rawUserEmail = typeof body.userEmail === 'string' ? body.userEmail : '';
    const requestedUserEmail = rawUserEmail.trim().toLowerCase();
    const userEmail = requestedUserEmail || authenticatedUserEmail;
    const { subscription, deviceInfo } = body;

    if (requestedUserEmail && requestedUserEmail !== authenticatedUserEmail) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (!subscription) {
      return NextResponse.json(
        { error: 'Missing required field: subscription' },
        { status: 400 }
      );
    }

    const endpoint = typeof subscription?.endpoint === 'string' ? subscription.endpoint : '';

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Missing required field: subscription.endpoint' },
        { status: 400 }
      );
    }

    const keys =
      subscription && typeof subscription === 'object' && 'keys' in subscription
        ? subscription.keys
        : {};

    const savedSubscription = await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userEmail,
        endpoint,
        keys: toJson(keys),
        subscription: toJson(subscription),
        deviceInfo: toJson(deviceInfo ?? {}),
        isActive: true,
        lastUsedAt: new Date(),
      },
      update: {
        userEmail,
        keys: toJson(keys),
        subscription: toJson(subscription),
        deviceInfo: toJson(deviceInfo ?? {}),
        isActive: true,
        lastUsedAt: new Date(),
        unsubscribedAt: null,
        deactivatedAt: null,
        deactivationReason: null,
      },
      select: { id: true },
    });

    await prisma.notificationPreference.upsert({
      where: { userEmail },
      create: {
        userEmail,
        enabled: true,
      },
      update: {
        enabled: true,
      },
    });

    console.log(`Push subscription created/updated for user ${userEmail}`);

    return NextResponse.json({
      success: true,
      message: 'Push subscription saved successfully',
      subscriptionId: savedSubscription.id
    });

  } catch (error) {
    console.error('Error in subscribe:', error);
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}
