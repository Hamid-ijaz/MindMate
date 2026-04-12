import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const normalizeUserEmail = (authorizationHeader: string | null): string | null => {
  if (!authorizationHeader) {
    return null;
  }

  const withoutBearer = authorizationHeader.replace('Bearer ', '').trim().toLowerCase();
  return withoutBearer.length > 0 ? withoutBearer : null;
};

// GET - Get all devices for a user
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const userEmail = normalizeUserEmail(authHeader);

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userEmail },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        deviceInfo: true,
        createdAt: true,
      },
    });

    const devices = subscriptions.map((subscription) => {
      const deviceInfo = isRecord(subscription.deviceInfo) ? subscription.deviceInfo : {};

      return {
        id: subscription.id,
        userAgent: typeof deviceInfo.userAgent === 'string' ? deviceInfo.userAgent : 'Unknown',
        platform: typeof deviceInfo.platform === 'string' ? deviceInfo.platform : 'Unknown',
        createdAt: subscription.createdAt.getTime(),
      };
    });

    return NextResponse.json({
      success: true,
      devices
    });

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Error fetching devices:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}

// DELETE - Remove a specific device subscription
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const userEmail = normalizeUserEmail(authHeader);

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { deviceId } = body;

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Missing deviceId' },
        { status: 400 }
      );
    }

    const subscription = await prisma.pushSubscription.findUnique({
      where: { id: deviceId },
      select: {
        id: true,
        userEmail: true,
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Device subscription not found' },
        { status: 404 }
      );
    }

    if (subscription.userEmail !== userEmail) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this device' },
        { status: 403 }
      );
    }

    // Delete the subscription
    await prisma.pushSubscription.delete({
      where: { id: deviceId },
    });

    return NextResponse.json({
      success: true,
      message: 'Device subscription removed successfully'
    });

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Error removing device:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}
