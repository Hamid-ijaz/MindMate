import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';

// Configure VAPID keys (you should set these as environment variables)
const vapidKeys = {
  publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BKzpVHtE7e5HZtyN-ZzfnWQh8JMN3XW2btzp4PPdEqoofR_51byv1858Vmj5Aufc62w59PxBZWVb_PNbU9ehsRQ',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'wBh74X3AO3rerrBHhSTQhtB176H7h5U17snwWfagcFA'
};

webpush.setVapidDetails(
  'mailto:hamid.ijaz91@gmail.com',
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
