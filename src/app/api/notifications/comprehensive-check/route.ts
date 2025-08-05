
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
    if (!isLoopRunning) {
      console.log('Loop stop requested, breaking user loop.');
      break;
    }
    const userEmail = prefDoc.id;
    console.log("🚀 > executeNotificationCheck > userEmail:", userEmail)
    const preferences = prefDoc.data();
    console.log("🚀 > executeNotificationCheck > preferences:", preferences)

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

      // Fetch all tasks for this user once
      const allTasksSnapshot = await db
        .collection('tasks')
        .where('userEmail', '==', userEmail)
        .get();
      function toMillis(val: any): number | undefined {
        if (!val) return undefined;
        if (typeof val === 'number') return val;
        if (typeof val === 'object' && typeof val._seconds === 'number') {
          return val._seconds * 1000 + Math.floor((val._nanoseconds || 0) / 1e6);
        }
        return undefined;
      }
      const allTasks = allTasksSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log("🚀 > executeNotificationCheck > data:", data.reminderAt)
        // Normalize all relevant fields to millis if present
        return {
          ...data,
          reminderAt: toMillis(data.reminderAt),
          completedAt: toMillis(data.completedAt),
          notifiedAt: toMillis(data.notifiedAt),
          lastRemindedAt: toMillis(data.lastRemindedAt),
          _doc: doc
        };
      });

      // Check for overdue tasks
      if (preferences.overdueAlerts) {
        const overdueTasks = allTasks.filter(task => {
          return task.reminderAt !=  undefined;
        });
        console.log("🚀 > executeNotificationCheck > overdueTasks:", overdueTasks.length)
        // Only process tasks that have reminderAt and completedAt fields
        const twentyFourHoursAgo = now.getTime() - (24 * 60 * 60 * 1000);
        const overdueTasksToNotify = overdueTasks.filter((task: any) => {
          if (typeof task.completedAt !== 'undefined' && task.completedAt) return false;
          if (typeof task.notifiedAt !== 'undefined' && task.notifiedAt >= twentyFourHoursAgo) return false;
          return task.reminderAt < now.getTime();
        });

        console.log("🚀 > executeNotificationCheck > overdueTasksToNotify.length:", overdueTasksToNotify.length)
        if (overdueTasksToNotify.length > 0) {
          for (const task of overdueTasksToNotify) {
            if (!isLoopRunning) {
              console.log('Loop stop requested, breaking overdue task loop.');
              break;
            }
            const taskTitle = (task._doc && typeof task._doc.data === 'function' && task._doc.data().title) ? task._doc.data().title : 'Untitled Task';
            const payload = {
              title: 'Task Overdue',
              body: `"${taskTitle}" is overdue!`,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: `overdue-task-${task._doc.id}`,
              data: {
                type: 'overdue-task',
                taskId: task._doc.id,
                title: taskTitle,
                url: `/task/${task._doc.id}`,
                timestamp: now.toISOString()
              }
            };

            // Send to all user's devices
            for (const sub of subscriptions) {
              if (!isLoopRunning) {
                console.log('Loop stop requested, breaking subscription loop (overdue).');
                break;
              }
              const result = await sendPushNotification(sub.data().subscription, payload);
              if (result.success) {
                results.totalNotificationsSent++;
              } else if (result.error?.includes('410') || result.error?.includes('404')) {
                // Remove invalid subscription
                await db.collection('pushSubscriptions').doc(sub.id).delete();
              }
            }

            // Mark this task as having been notified
            await task._doc.ref.update({ notifiedAt: now.getTime() });
            results.overdueNotifications++;
          }
        }
      }

      // Check for upcoming task reminders
      if (preferences.taskReminders) {
        const reminderTime = now.getTime() + (2 * 60 * 60 * 1000); // 2 hours from now
        const thirtyMinutesAgo = now.getTime() - (30 * 60 * 1000); // 30 minutes ago
        const RemindTasks = allTasks.filter(task => {
                  return task.reminderAt !=  undefined;
                });
        // Only process tasks that have reminderAt field
        const tasksToRemind = RemindTasks.filter((task: any) => {
          if (typeof task.reminderAt !== 'number') return false;
          if (typeof task.completedAt !== 'undefined' && task.completedAt) return false;
          if (typeof task.lastRemindedAt !== 'undefined' && task.lastRemindedAt >= thirtyMinutesAgo) return false;
          return task.reminderAt > now.getTime() && task.reminderAt <= reminderTime;
        });

        for (const task of tasksToRemind as any[]) {
          if (!isLoopRunning) {
            console.log('Loop stop requested, breaking reminder task loop.');
            break;
          }
          const timeUntilDue = Math.round((task.reminderAt - now.getTime()) / (60 * 1000));
          const taskTitle = (task._doc && typeof task._doc.data === 'function' && task._doc.data().title) ? task._doc.data().title : 'Untitled Task';
          const payload = {
            title: 'Task Reminder',
            body: `"${taskTitle}" is due in ${timeUntilDue} minutes`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: `task-reminder-${task._doc.id}`,
            data: {
              type: 'task-reminder',
              taskId: task._doc.id,
              title: taskTitle,
              url: `/task/${task._doc.id}`,
              timestamp: now.toISOString()
            }
          };

          // Send to all user's devices
          for (const sub of subscriptions) {
            if (!isLoopRunning) {
              console.log('Loop stop requested, breaking subscription loop (reminder).');
              break;
            }
            const result = await sendPushNotification(sub.data().subscription, payload);
            if (result.success) {
              results.totalNotificationsSent++;
            } else if (result.error?.includes('410') || result.error?.includes('404')) {
              // Remove invalid subscription
              await db.collection('pushSubscriptions').doc(sub.id).delete();
            }
          }

          // Update reminder timestamp
          await task._doc.ref.update({ lastRemindedAt: now.getTime() });
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
    const maxRunTime = 24 * 60 * 60 * 1000; // 24 hours
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
        if (timeRemaining < 1 * 60 * 1000) { // Less than 1 minute remaining
          console.log('Not enough time for another cycle, ending loop');
          break;
        }
        
        // Wait for 30 sec before next cycle
        console.log('Waiting 30 seconds before next cycle...');
        await new Promise(resolve => setTimeout(resolve, 30 * 1000)); // 30 seconds

      } catch (cycleError: any) {
        console.error('Error in notification cycle:', cycleError);
        totalResults.allErrors.push(`Cycle ${totalResults.cycles + 1} error: ${cycleError.message}`);
        // Continue with the loop even if one cycle fails
        await new Promise(resolve => setTimeout(resolve, 0.5 * 60 * 1000)); // Still wait 30 minutes
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
    // const isScheduledJob = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    
    // if (!isScheduledJob) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

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
  // Generate a test notification to all users
  try {
    const db = getFirestore();
    const preferencesSnapshot = await db.collection('notificationPreferences').get();
    let totalSent = 0;
    let errors: string[] = [];

    for (const prefDoc of preferencesSnapshot.docs) {
      const userEmail = prefDoc.id;
      const preferences = prefDoc.data();

      if (!preferences.enabled) continue;

      const subscriptionsSnapshot = await db
        .collection('pushSubscriptions')
        .where('userEmail', '==', userEmail)
        .get();

      if (subscriptionsSnapshot.empty) continue;

      const payload = {
        title: 'Test Notification',
        body: 'This is a test notification from MindMate.',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'test-notification',
        data: {
          type: 'test',
          timestamp: new Date().toISOString()
        }
      };

      for (const sub of subscriptionsSnapshot.docs) {
        const result = await sendPushNotification(sub.data().subscription, payload);
        if (result.success) {
          totalSent++;
        } else {
          errors.push(`User ${userEmail} sub ${sub.id}: ${result.error}`);
          if (result.error?.includes('410') || result.error?.includes('404')) {
            await db.collection('pushSubscriptions').doc(sub.id).delete();
          }
        }
      }
    }

    return NextResponse.json({
      isLoopRunning,
      loopStartTime: loopStartTime?.toISOString() || null,
      testNotification: {
        totalSent,
        errors
      },
      message: `Test notification sent to all users. Total sent: ${totalSent}`
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        isLoopRunning,
        loopStartTime: loopStartTime?.toISOString() || null,
        error: error.message,
        message: 'Failed to send test notification'
      },
      { status: 500 }
    );
  }
}


// Support DELETE to stop the notification loop
export async function DELETE(request: NextRequest) {
  isLoopRunning = false;
  loopStartTime = null;
  console.log('Notification loop stopped by DELETE request.');
  return NextResponse.json({
    success: true,
    message: 'Notification loop stopped.'
  });
}