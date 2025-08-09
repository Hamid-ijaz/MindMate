import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';

// Configure VAPID keys (you should set these as environment variables)
const vapidKeys = {
  publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY
};

// Only configure webpush if both keys are available
if (vapidKeys.publicKey && vapidKeys.privateKey) {
  try {
    webpush.setVapidDetails(
      'mailto:hamid.ijaz91@gmail.com',
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
  } catch (error) {
    console.warn('Failed to configure VAPID keys:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if VAPID keys are configured
    if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
      return NextResponse.json(
        { error: 'Push notifications not configured' },
        { status: 503 }
      );
    }

    const { subscription, title, body, data } = await request.json();

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription is required' },
        { status: 400 }
      );
    }

    const payload = JSON.stringify({
      title: title || 'MindMate Notification',
      body: body || 'You have a new notification',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: data || {},
      actions: [
        {
          action: 'view',
          title: 'View Task',
          icon: '/icon-192.png'
        },
        {
          action: 'complete',
          title: 'Mark Complete',
          icon: '/icon-192.png'
        }
      ]
    });

    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      }
    };

    await webpush.sendNotification(pushSubscription, payload);

    return NextResponse.json(
      { message: 'Notification sent successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error sending push notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
