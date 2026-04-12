import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

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
    const body = await request.json();
    const rawUserEmail = typeof body.userEmail === 'string' ? body.userEmail : '';
    const userEmail = rawUserEmail.trim().toLowerCase();
    const { subscription, deviceInfo } = body;

    if (!userEmail || !subscription) {
      return NextResponse.json(
        { error: 'Missing required fields: userEmail, subscription' },
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
