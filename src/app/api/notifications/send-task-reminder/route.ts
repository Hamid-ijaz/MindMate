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
    const { taskId, userEmail, title, message } = body;

    if (!taskId || !userEmail || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: taskId, userEmail, title, message' },
        { status: 400 }
      );
    }

    const db = getFirestore();

    // Get user's push subscriptions
    const subscriptionsSnapshot = await db.collection('pushSubscriptions')
      .where('userEmail', '==', userEmail)
      .where('isActive', '==', true)
      .get();

    if (subscriptionsSnapshot.empty) {
      return NextResponse.json(
        { error: 'No push subscriptions found for user' },
        { status: 404 }
      );
    }

    // First, save notification to Firestore
    const notificationId = `notif_${userEmail.replace('@', '_').replace('.', '_')}_${Date.now()}`;
    const notificationData = {
      id: notificationId,
      userEmail,
      title,
      body: message,
      type: 'push',
      // Only include relatedTaskId if defined, else set to null
      relatedTaskId: typeof taskId !== 'undefined' ? taskId : null,
      isRead: false,
      createdAt: new Date(),
      data: {
        type: 'task-reminder',
        taskId,
        taskTitle: title,
      },
    };
    
    // Save notification to user's notifications subcollection
    await db.collection(`users/${userEmail}/notifications`).doc(notificationId).set(notificationData);
    console.log(`💾 Saved notification to Firestore: ${notificationId}`);

    // Prepare notification payload
    const payload = {
      title,
      body: message,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `task-${taskId}`,
      data: {
        type: 'task-reminder',
        taskId,
        notificationId, // Include the Firestore notification ID
  userEmail,
        url: `/task/${taskId}`
      }
    };

    // Send push notification to all user's devices
    const pushPromises = subscriptionsSnapshot.docs.map(async (subDoc) => {
      const subscription = subDoc.data().subscription;
      
      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
        console.log(`Task reminder sent successfully for task ${taskId} to user ${userEmail}`);
        return { success: true, subscriptionId: subDoc.id };
      } catch (error) {
        console.error(`Failed to send task reminder for task ${taskId}:`, error);
        
        // If subscription is invalid, remove it
        if (error.statusCode === 410 || error.statusCode === 404) {
          await subDoc.ref.delete();
          console.log(`Removed invalid subscription ${subDoc.id} for user ${userEmail}`);
        }
        
        return { success: false, error: error.message, subscriptionId: subDoc.id };
      }
    });

    const results = await Promise.all(pushPromises);
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    // Update notification with sent status and task's notified timestamp
    const batch = db.batch();
    
    if (successCount > 0) {
      // Update the notification with sentAt timestamp
      const notificationRef = db.collection(`users/${userEmail}/notifications`).doc(notificationId);
      batch.update(notificationRef, { sentAt: new Date() });
      
      // Update task's last notified timestamp
      const taskRef = db.collection('tasks').doc(taskId);
      batch.update(taskRef, { notifiedAt: new Date() });
      
      await batch.commit();
      console.log(`📝 Updated notification sentAt and task notifiedAt for task ${taskId}`);
    }

    return NextResponse.json({
      success: true,
      message: `Task reminder sent to ${successCount}/${totalCount} subscriptions`,
      taskId,
      userEmail,
      notificationId,
      notificationsSent: successCount,
      totalSubscriptions: totalCount,
      results
    });

  } catch (error) {
    console.error('Error in send-task-reminder:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
