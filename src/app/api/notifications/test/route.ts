import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import webpush from 'web-push';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  try {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

// Configure VAPID keys for web push
try {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_EMAIL) {
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  }
} catch (error) {
  console.error('VAPID configuration error:', error);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userEmail, message } = body;

    if (!userEmail || !message) {
      return NextResponse.json(
        { error: 'Missing userEmail or message' },
        { status: 400 }
      );
    }

    const db = getFirestore();

    // Get all push subscriptions for this user
    const subscriptionsSnapshot = await db
      .collection('pushSubscriptions')
      .where('userEmail', '==', userEmail)
      .get();

    if (subscriptionsSnapshot.empty) {
      return NextResponse.json(
        { error: 'No active subscriptions found for this user' },
        { status: 404 }
      );
    }

    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    // Send test notification to all user's devices
    for (const doc of subscriptionsSnapshot.docs) {
      const subscriptionData = doc.data();

      // normalize subscription object for web-push
      const pushSubscription = subscriptionData.subscription
        ? subscriptionData.subscription
        : (subscriptionData.endpoint && subscriptionData.keys)
          ? {
            endpoint: subscriptionData.endpoint,
            keys: subscriptionData.keys,
          }
          : null;

      if (!pushSubscription || !pushSubscription.endpoint) {
        console.warn(`Skipping subscription ${doc.id} - missing endpoint`, subscriptionData);
        failureCount++;
        errors.push(`Subscription ${doc.id}: missing endpoint`);

        // Deactivate invalid subscription to avoid repeated failures
        try {
          await db.collection('pushSubscriptions').doc(doc.id).update({
            isActive: false,
            deactivatedAt: new Date(),
            deactivationReason: 'missing_endpoint'
          });
          console.log(`Deactivated subscription ${doc.id} due to missing endpoint`);
        } catch (updateErr) {
          console.error(`Failed to deactivate invalid subscription ${doc.id}:`, updateErr);
        }

        continue;
      }

      try {
        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify({
            title: message.title || 'Test Notification',
            body: message.body || 'This is a test notification from MindMate.',
            icon: message.icon || '/icon-192.png',
            badge: message.badge || '/icon-192.png',
            tag: 'test-notification',
            data: {
              type: 'test',
              timestamp: new Date().toISOString(),
              url: '/'
            }
          })
        );

        successCount++;
      } catch (error: any) {
        console.error(`Failed to send test notification to subscription ${doc.id}:`, error);
        failureCount++;

        // If subscription is invalid (410 or 404), remove it
        if (error.statusCode === 410 || error.statusCode === 404) {
          try {
            await db.collection('pushSubscriptions').doc(doc.id).delete();
            console.log(`Removed invalid subscription: ${doc.id}`);
          } catch (deleteError) {
            console.error(`Failed to delete invalid subscription ${doc.id}:`, deleteError);
          }
        }

        errors.push(`Subscription ${doc.id}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Test notification sent successfully`,
      stats: {
        successCount,
        failureCount,
        totalSubscriptions: subscriptionsSnapshot.size
      },
      errors: failureCount > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('Error sending test notification:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
