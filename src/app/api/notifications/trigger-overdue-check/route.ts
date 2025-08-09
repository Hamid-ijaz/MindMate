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
    // Verify request (optional: check for secret token)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getFirestore();
    const now = new Date();
    
    // Query for overdue tasks
    const tasksSnapshot = await db.collection('tasks')
      .where('completed', '==', false)
      .where('dueDate', '<=', now)
      .where('isMuted', '==', false)
      .get();

    const overdueTasksCount = tasksSnapshot.size;
    const processedUsers = new Set<string>();

    console.log(`Found ${overdueTasksCount} overdue tasks`);

    // Process each overdue task
    for (const taskDoc of tasksSnapshot.docs) {
      const task = taskDoc.data();
      const userEmail = task.userEmail; // Use userEmail for consistency

      // Only process each user once
      if (processedUsers.has(userEmail)) {
        continue;
      }
      processedUsers.add(userEmail);

      try {
        // Get user's push subscriptions using userEmail
        const subscriptionsSnapshot = await db.collection('pushSubscriptions')
          .where('userEmail', '==', userEmail)
          .where('isActive', '==', true)
          .get();

        if (subscriptionsSnapshot.empty) {
          console.log(`No push subscriptions found for user ${userEmail}`);
          continue;
        }

        // Count overdue tasks for this user
        const userOverdueTasksSnapshot = await db.collection('tasks')
          .where('userEmail', '==', userEmail)
          .where('completed', '==', false)
          .where('dueDate', '<=', now)
          .where('isMuted', '==', false)
          .get();

        const userOverdueCount = userOverdueTasksSnapshot.size;
        
        // Send push notification to all user's devices
        const pushPromises = subscriptionsSnapshot.docs.map(async (subDoc) => {
          const subscription = subDoc.data().subscription;
          
          const payload = {
            title: 'Overdue Tasks',
            body: `You have ${userOverdueCount} overdue task${userOverdueCount !== 1 ? 's' : ''}`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: 'overdue-tasks',
            data: {
              type: 'overdue',
              count: userOverdueCount,
              url: '/tasks'
            }
          };

          try {
            await webpush.sendNotification(subscription, JSON.stringify(payload));
            console.log(`Push notification sent successfully to user ${userEmail}`);
          } catch (error: any) {
            console.error(`Failed to send push notification to user ${userEmail}:`, error);
            
            // If subscription is invalid, remove it
            if (error?.statusCode === 410 || error?.statusCode === 404) {
              await subDoc.ref.delete();
              console.log(`Removed invalid subscription for user ${userEmail}`);
            }
          }
        });

        await Promise.all(pushPromises);

        // Update last notified timestamp for user's overdue tasks
        const updatePromises = userOverdueTasksSnapshot.docs.map(doc => 
          doc.ref.update({ notifiedAt: now })
        );
        await Promise.all(updatePromises);

      } catch (error) {
        console.error(`Error processing notifications for user ${userEmail}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${overdueTasksCount} overdue tasks for ${processedUsers.size} users`,
      overdueTasksCount,
      usersNotified: processedUsers.size
    });

  } catch (error) {
    console.error('Error in trigger-overdue-check:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// Also support GET for testing
export async function GET(request: NextRequest) {
  return POST(request);
}
