import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';

// Configure VAPID keys (you should set these as environment variables)
const vapidKeys = {
  publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa40HI8PzJqJGb3b3_3bW-bBw8Y7vhM9qJ8PJwOEwGh1L3A4K4YxYK0e6R3cHE',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'your-private-vapid-key-here'
};

webpush.setVapidDetails(
  'mailto:your-email@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

export async function POST(request: NextRequest) {
  try {
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
