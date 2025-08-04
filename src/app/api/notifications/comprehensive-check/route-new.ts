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

// Helper function to check if current time is within quiet hours
function isInQuietHours(quietHours: any): boolean {
  if (!quietHours?.enabled) return false;
  
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  
  const [startHour, startMin] = quietHours.start.split(':').map(Number);
  const [endHour, endMin] = quietHours.end.split(':').map(Number);
  
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;
  
  if (startTime <= endTime) {
    return currentTime >= startTime && currentTime <= endTime;
  } else {
    // Quiet hours span midnight
    return currentTime >= startTime || currentTime <= endTime;
  }
}

// Helper function to send push notification
async function sendPushNotification(subscription: any, payload: any): Promise<{ success: boolean; error?: string }> {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { success: true };
  } catch (error: any) {
    console.error('Push notification error:', error);
    return { success: false, error: error.message };
  }
}

// Global state to track the execution loop
let isLoopRunning = false;
let loopStartTime: Date | null = null;

async function executeNotificationCheck(): Promise<any> {
  console.log('Executing notification check cycle...');
  
  const db = getFirestore();
  const now = new Date();
  
  const results = {
    usersProcessed: 0,
    overdueNotifications: 0,
    reminderNotifications: 0,
    totalNotificationsSent: 0,
    errors: [] as string[]
  };

  // Get all users who have push notification preferences
  const preferencesSnapshot = await db.collection('notificationPreferences').get();
  
  for (const prefDoc of preferencesSnapshot.docs) {
    const userEmail = prefDoc.id;
    const preferences = prefDoc.data();

    try {
      // Skip if notifications are disabled for this user
      if (!preferences.enabled) {
        continue;
      }

      // Check quiet hours
      if (isInQuietHours(preferences.quietHours)) {
        console.log(`Skipping user ${userEmail} - in quiet hours`);
        continue;
      }

      // Get user's push subscriptions
      const subscriptionsSnapshot = await db
        .collection('pushSubscriptions')
        .where('userEmail', '==', userEmail)
        .get();

      if (subscriptionsSnapshot.empty) {
        continue;
      }

      const subscriptions = subscriptionsSnapshot.docs;

      // Check for overdue tasks
      if (preferences.overdueAlerts) {
        const overdueTasksSnapshot = await db
          .collection('tasks')
          .where('userEmail', '==', userEmail)
          .where('isCompleted', '==', false)
          .where('dueDate', '<', now)
          .where('overdueNotificationSent', '==', false)
          .get();

        if (!overdueTasksSnapshot.empty) {
          const overdueCount = overdueTasksSnapshot.size;
          const payload = {
            title: 'Overdue Tasks Alert',
            body: `You have ${overdueCount} overdue task${overdueCount > 1 ? 's' : ''} that need attention`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: 'overdue-tasks',
            data: {
              type: 'overdue-alert',
              taskCount: overdueCount,
              url: '/task?filter=overdue',
              timestamp: now.toISOString()
            }
          };

          // Send to all user's devices
          for (const sub of subscriptions) {
            const result = await sendPushNotification(sub.data().subscription, payload);
            if (result.success) {
              results.totalNotificationsSent++;
            } else if (result.error?.includes('410') || result.error?.includes('404')) {
              // Remove invalid subscription
              await db.collection('pushSubscriptions').doc(sub.id).delete();
            }
          }

          // Mark tasks as having overdue notification sent
          const batch = db.batch();
          overdueTasksSnapshot.docs.forEach(taskDoc => {
            batch.update(taskDoc.ref, { overdueNotificationSent: true });
          });
          await batch.commit();

          results.overdueNotifications++;
        }
      }

      // Check for upcoming task reminders
      if (preferences.taskReminders) {
        const reminderTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now
        
        const upcomingTasksSnapshot = await db
          .collection('tasks')
          .where('userEmail', '==', userEmail)
          .where('isCompleted', '==', false)
          .where('dueDate', '>', now)
          .where('dueDate', '<=', reminderTime)
          .where('reminderAt', '<', new Date(now.getTime() - 30 * 60 * 1000)) // Not reminded in last 30 minutes
          .get();

        for (const taskDoc of upcomingTasksSnapshot.docs) {
          const task = taskDoc.data();
          const timeUntilDue = Math.round((task.dueDate.toDate().getTime() - now.getTime()) / (60 * 1000));
          
          const payload = {
            title: 'Task Reminder',
            body: `"${task.title}" is due in ${timeUntilDue} minutes`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: `task-reminder-${taskDoc.id}`,
            data: {
              type: 'task-reminder',
              taskId: taskDoc.id,
              url: `/task/${taskDoc.id}`,
              timestamp: now.toISOString()
            }
          };

          // Send to all user's devices
          for (const sub of subscriptions) {
            const result = await sendPushNotification(sub.data().subscription, payload);
            if (result.success) {
              results.totalNotificationsSent++;
            } else if (result.error?.includes('410') || result.error?.includes('404')) {
              // Remove invalid subscription
              await db.collection('pushSubscriptions').doc(sub.id).delete();
            }
          }

          // Update reminder timestamp
          await taskDoc.ref.update({ reminderAt: now });
          results.reminderNotifications++;
        }
      }

      results.usersProcessed++;

    } catch (error: any) {
      console.error(`Error processing notifications for user ${userEmail}:`, error);
      results.errors.push(`User ${userEmail}: ${error.message}`);
    }
  }

  return results;
}

async function startNotificationLoop() {
  if (isLoopRunning) {
    console.log('Notification loop already running, skipping...');
    return { success: true, message: 'Loop already running' };
  }

  isLoopRunning = true;
  loopStartTime = new Date();
  
  console.log('Starting 30-minute notification loop...');
  
  const totalResults = {
    cycles: 0,
    totalUsersProcessed: 0,
    totalOverdueNotifications: 0,
    totalReminderNotifications: 0,
    totalNotificationsSent: 0,
    allErrors: [] as string[],
    startTime: loopStartTime.toISOString(),
    endTime: ''
  };

  try {
    // Run the loop for maximum Vercel timeout (58 minutes to be safe)
    const maxRunTime = 58 * 60 * 1000; // 58 minutes
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxRunTime && isLoopRunning) {
      try {
        console.log(`Starting notification check cycle ${totalResults.cycles + 1}...`);
        const cycleStart = new Date();
        const cycleResults = await executeNotificationCheck();
        
        totalResults.cycles++;
        totalResults.totalUsersProcessed += cycleResults.usersProcessed;
        totalResults.totalOverdueNotifications += cycleResults.overdueNotifications;
        totalResults.totalReminderNotifications += cycleResults.reminderNotifications;
        totalResults.totalNotificationsSent += cycleResults.totalNotificationsSent;
        totalResults.allErrors.push(...cycleResults.errors);
        
        const cycleDuration = Date.now() - cycleStart.getTime();
        console.log(`Cycle ${totalResults.cycles} completed in ${cycleDuration}ms:`, cycleResults);
        
        // Check if we have enough time for another full cycle (30 min + buffer)
        const timeRemaining = maxRunTime - (Date.now() - startTime);
        if (timeRemaining < 31 * 60 * 1000) { // Less than 31 minutes remaining
          console.log('Not enough time for another cycle, ending loop');
          break;
        }
        
        // Wait for 30 minutes before next cycle
        console.log('Waiting 30 minutes before next cycle...');
        await new Promise(resolve => setTimeout(resolve, 30 * 60 * 1000));
        
      } catch (cycleError: any) {
        console.error('Error in notification cycle:', cycleError);
        totalResults.allErrors.push(`Cycle ${totalResults.cycles + 1} error: ${cycleError.message}`);
        // Continue with the loop even if one cycle fails
        await new Promise(resolve => setTimeout(resolve, 30 * 60 * 1000)); // Still wait 30 minutes
      }
    }
    
  } finally {
    const endTime = new Date();
    totalResults.endTime = endTime.toISOString();
    isLoopRunning = false;
    loopStartTime = null;
    
    const totalDuration = endTime.getTime() - new Date(totalResults.startTime).getTime();
    console.log(`Notification loop completed after ${Math.round(totalDuration / 60000)} minutes. Total results:`, totalResults);
  }
  
  return {
    success: true,
    message: 'Notification loop completed',
    results: totalResults
  };
}

export async function POST(request: NextRequest) {
  console.log('Comprehensive notification check endpoint called...');
  
  try {
    const authHeader = request.headers.get('authorization');
    const isScheduledJob = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    
    if (!isScheduledJob) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if we want to run a single check or start the loop
    const url = new URL(request.url);
    const mode = url.searchParams.get('mode') || 'loop'; // Default to loop mode
    
    if (mode === 'single') {
      // Single execution mode (for testing)
      const results = await executeNotificationCheck();
      console.log('Single notification check completed:', results);
      
      return NextResponse.json({
        success: true,
        message: 'Single notification check completed',
        results
      });
    } else {
      // Loop mode (default for production)
      const results = await startNotificationLoop();
      
      return NextResponse.json({
        success: true,
        message: 'Notification loop process completed',
        results
      });
    }

  } catch (error: any) {
    console.error('Error in comprehensive notification check:', error);
    isLoopRunning = false;
    loopStartTime = null;
    
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// Also support GET for testing
export async function GET(request: NextRequest) {
  // Return loop status for monitoring
  return NextResponse.json({
    isLoopRunning,
    loopStartTime: loopStartTime?.toISOString() || null,
    message: isLoopRunning ? 'Notification loop is currently running' : 'No notification loop running'
  });
}
