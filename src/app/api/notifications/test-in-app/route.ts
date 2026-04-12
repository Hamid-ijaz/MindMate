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
    const title = typeof body.title === 'string' ? body.title : '';
    const messageBody = typeof body.body === 'string' ? body.body : '';

    if (requestedUserEmail && requestedUserEmail !== authenticatedUserEmail) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (!title || !messageBody) {
      return NextResponse.json(
        { error: 'Missing required fields: title, body' },
        { status: 400 }
      );
    }

    // Create test in-app notification
    const notificationId = `notif_test_${userEmail.replace('@', '_').replace('.', '_')}_${Date.now()}`;
    const notificationData = {
      id: notificationId,
      userEmail,
      title,
      body: messageBody,
      type: 'in_app',
      isRead: false,
      createdAt: new Date(),
      data: {
        type: 'system',
        metadata: {
          isTest: true,
        },
      },
    };

    await prisma.notification.create({
      data: {
        id: notificationId,
        userEmail,
        title,
        body: messageBody,
        type: 'in_app',
        isRead: false,
        createdAt: notificationData.createdAt,
        data: toJson(notificationData.data),
      },
    });

    console.log(`💾 Created test in-app notification: ${notificationId}`);

    return NextResponse.json({
      success: true,
      message: 'Test in-app notification created successfully',
      notificationId,
      userEmail,
      data: notificationData,
    });

  } catch (error) {
    console.error('Error creating test in-app notification:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}