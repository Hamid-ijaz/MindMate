
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


// Firestore-based loop control
const LOOP_CONTROL_DOC = 'notificationLoop/control';

async function setLoopRunningState(isRunning: boolean) {
  const db = getFirestore();
  const pkDate = new Date();
  const pkTimeString = pkDate.toLocaleString('en-US', {
    timeZone: 'Asia/Karachi',
    hour12: true,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  // pkTimeString will be in "MM/DD/YYYY, hh:mm:ss AM/PM" format
  await db.doc(LOOP_CONTROL_DOC).set(
    { isLoopRunning: isRunning, updatedAt: pkTimeString },
    { merge: true }
  );
  }

  async function getLoopRunningState(): Promise<boolean> {
    const db = getFirestore();
    const docRef = db.doc(LOOP_CONTROL_DOC);
    const doc = await docRef.get();
    // Update the 'updatedAt' field to current date/time in Pakistan timezone in 12-hour AM/PM format
    const pkDate = new Date();
    const pkTimeString = pkDate.toLocaleString('en-US', {
      timeZone: 'Asia/Karachi',
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    await docRef.set({ updatedAt: pkTimeString }, { merge: true });
    return !!doc.data()?.isLoopRunning;
}

let loopStartTime: Date | null = null;

// Helper function to send daily digest email
async function sendDailyDigestForUser(userEmail: string): Promise<{ success: boolean; error?: string }> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://mindmate.hamidijaz.dev';
    const apiUrl = `${baseUrl}/api/email/daily-digest`;
    
    console.log(`📧 Sending daily digest request to ${userEmail} via ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userEmail }),
    });

    console.log(`📧 Daily digest API response: ${response.status} ${response.statusText}`);

    if (response.ok) {
      console.log(`✅ Daily digest sent successfully to ${userEmail}`);
      return { success: true };
    } else {
      // Log response body for debugging
      const responseText = await response.text();
      console.log(`📧 Daily digest error response body:`, responseText);
      
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch (jsonError) {
        // Response doesn't contain valid JSON
        errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
      }
      console.error(`❌ Failed to send daily digest to ${userEmail}:`, errorData);
      return { success: false, error: errorData.error || `HTTP ${response.status}` };
    }
  } catch (error) {
    console.error(`❌ Error sending daily digest to ${userEmail}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Helper function to send weekly digest email
async function sendWeeklyDigestForUser(userEmail: string): Promise<{ success: boolean; error?: string }> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://mindmate.hamidijaz.dev';
    const apiUrl = `${baseUrl}/api/email/weekly-digest-enhanced`;
    
    console.log(`📧 Sending weekly digest request to ${userEmail} via ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userEmail }),
    });

    console.log(`📧 Weekly digest API response: ${response.status} ${response.statusText}`);

    if (response.ok) {
      console.log(`✅ Weekly digest sent successfully to ${userEmail}`);
      return { success: true };
    } else {
      // Log response body for debugging
      const responseText = await response.text();
      console.log(`📧 Weekly digest error response body:`, responseText);
      
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch (jsonError) {
        // Response doesn't contain valid JSON
        errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
      }
      console.error(`❌ Failed to send weekly digest to ${userEmail}:`, errorData);
      return { success: false, error: errorData.error || `HTTP ${response.status}` };
    }
  } catch (error) {
    console.error(`❌ Error sending weekly digest to ${userEmail}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Helper function to check if daily digest should be sent based on schedule and sent history
async function shouldSendDailyDigest(preferences: any, now: Date, db: any, userEmail: string): Promise<{ shouldSend: boolean; reason: string }> {
  if (!preferences.dailyDigest) {
    return { shouldSend: false, reason: 'Daily digest disabled' };
  }
  
  const dailyDigestTime = preferences.dailyDigestTime || '09:00';
  const [hour, minute] = dailyDigestTime.split(':').map(Number);
  
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  // Check if we've passed the scheduled time today
  const scheduledMinutes = hour * 60 + minute;
  const currentMinutes = currentHour * 60 + currentMinute;
  
  if (currentMinutes < scheduledMinutes) {
    return { shouldSend: false, reason: `Scheduled time (${dailyDigestTime}) not yet reached today` };
  }
  
  // Check if daily digest has already been sent today
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime();
  
  const lastDailySent = preferences.lastDailySent;
  if (lastDailySent) {
    const lastSentDate = lastDailySent.toDate ? lastDailySent.toDate() : new Date(lastDailySent);
    const lastSentDay = new Date(lastSentDate);
    lastSentDay.setHours(0, 0, 0, 0);
    
    if (lastSentDay.getTime() === todayTimestamp) {
      return { shouldSend: false, reason: `Daily digest already sent today at ${lastSentDate.toLocaleTimeString()}` };
    }
  }
  
  return { shouldSend: true, reason: `Scheduled time passed and not yet sent today` };
}

// Helper function to check if weekly digest should be sent based on schedule and sent history
async function shouldSendWeeklyDigest(preferences: any, now: Date, db: any, userEmail: string): Promise<{ shouldSend: boolean; reason: string }> {
  if (!preferences.weeklyDigest) {
    return { shouldSend: false, reason: 'Weekly digest disabled' };
  }
  
  const digestDay = preferences.digestDay || 'monday';
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDay = dayNames.indexOf(digestDay.toLowerCase());
  
  if (targetDay === -1) {
    return { shouldSend: false, reason: 'Invalid digest day configured' };
  }
  
  const currentDay = now.getDay();
  const currentHour = now.getHours();
  
  // Check if it's the right day and we've passed 9 AM
  if (currentDay !== targetDay) {
    const currentDayName = dayNames[currentDay];
    return { shouldSend: false, reason: `Today is ${currentDayName}, weekly digest scheduled for ${digestDay}` };
  }
  
  if (currentHour < 9) {
    return { shouldSend: false, reason: `Scheduled time (9:00 AM) not yet reached today` };
  }
  
  // Check if weekly digest has already been sent this week
  // Calculate start of current week (Sunday)
  const startOfWeek = new Date(now);
  const daysFromSunday = now.getDay();
  startOfWeek.setDate(now.getDate() - daysFromSunday);
  startOfWeek.setHours(0, 0, 0, 0);
  
  const lastWeeklySent = preferences.lastWeeklySent;
  if (lastWeeklySent) {
    const lastSentDate = lastWeeklySent.toDate ? lastWeeklySent.toDate() : new Date(lastWeeklySent);
    
    // Check if last sent date is within current week
    if (lastSentDate >= startOfWeek) {
      return { shouldSend: false, reason: `Weekly digest already sent this week on ${lastSentDate.toLocaleDateString()} at ${lastSentDate.toLocaleTimeString()}` };
    }
  }
  
  return { shouldSend: true, reason: `Scheduled day and time passed, not yet sent this week` };
}

// Separate function for handling push notifications
async function processPushNotifications(db: any, now: Date): Promise<any> {
  console.log('🔔 Processing push notifications...');
  
  const results = {
    type: 'push_notifications',
    startTime: now.toISOString(),
    usersProcessed: 0,
    usersSkipped: 0,
    overdueNotifications: 0,
    reminderNotifications: 0,
    totalNotificationsSent: 0,
    totalSubscriptionsProcessed: 0,
    invalidSubscriptionsRemoved: 0,
    errors: [] as string[],
    successLogs: [] as string[],
    userDetails: [] as any[],
    summary: {} as any
  };

  // Get all users who have push notification preferences
  const preferencesSnapshot = await db.collection('notificationPreferences').get();
  

  for (const prefDoc of preferencesSnapshot.docs) {
    
    const userEmail = prefDoc.id;
    console.log("🚀 > processPushNotifications > userEmail:", userEmail)
    const preferences = prefDoc.data();

    const userDetail = {
      userEmail,
      preferences: {
        enabled: preferences.enabled,
        overdueAlerts: preferences.overdueAlerts,
        taskReminders: preferences.taskReminders,
        quietHours: preferences.quietHours
      },
      status: '',
      notifications: {
        overdue: 0,
        reminders: 0,
        total: 0
      },
      subscriptions: {
        total: 0,
        active: 0,
        removed: 0
      },
      tasks: {
        total: 0,
        overdue: 0,
        reminders: 0
      },
      errors: [] as string[],
      logs: [] as string[]
    };

    try {
      // Skip if notifications are disabled for this user
      if (!preferences.enabled) {
        userDetail.status = 'skipped_disabled';
        userDetail.logs.push('Notifications disabled for user');
        results.usersSkipped++;
        results.userDetails.push(userDetail);
        continue;
      }

      // Check quiet hours
      if (isInQuietHours(preferences.quietHours)) {
        userDetail.status = 'skipped_quiet_hours';
        userDetail.logs.push('User in quiet hours');
        console.log(`Skipping user ${userEmail} - in quiet hours`);
        results.usersSkipped++;
        results.userDetails.push(userDetail);
        continue;
      }

      // Get user's push subscriptions
      const subscriptionsSnapshot = await db
        .collection('pushSubscriptions')
        .where('userEmail', '==', userEmail)
        .get();

      if (subscriptionsSnapshot.empty) {
        userDetail.status = 'skipped_no_subscriptions';
        userDetail.logs.push('No push subscriptions found');
        results.usersSkipped++;
        results.userDetails.push(userDetail);
        continue;
      }

      const subscriptions = subscriptionsSnapshot.docs;
      userDetail.subscriptions.total = subscriptions.length;
      userDetail.logs.push(`Found ${subscriptions.length} push subscriptions`);
      results.totalSubscriptionsProcessed += subscriptions.length;

      // Fetch all tasks for this user once
      const allTasksSnapshot = await db
        .collection('tasks')
        .where('userEmail', '==', userEmail)
        .get();
      
      userDetail.tasks.total = allTasksSnapshot.docs.length;
      userDetail.logs.push(`Found ${allTasksSnapshot.docs.length} total tasks`);
      
      function toMillis(val: any): number | undefined {
        if (!val) return undefined;
        if (typeof val === 'number') return val;
        if (typeof val === 'object' && typeof val._seconds === 'number') {
          return val._seconds * 1000 + Math.floor((val._nanoseconds || 0) / 1e6);
        }
        return undefined;
      }
      const allTasks = allTasksSnapshot.docs.map((doc: any) => {
        const data = doc.data();
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
        const overdueTasks = allTasks.filter((task: any) => {
          return task.reminderAt !=  undefined;
        });
        
        userDetail.tasks.overdue = overdueTasks.length;
        userDetail.logs.push(`Found ${overdueTasks.length} tasks with reminder times`);
        
        // Only process tasks that have reminderAt and completedAt fields
        const twentyFourHoursAgo = now.getTime() - (24 * 60 * 60 * 1000);
        const overdueTasksToNotify = overdueTasks.filter((task: any) => {
          if (typeof task.completedAt !== 'undefined' && task.completedAt) return false;
          if (typeof task.notifiedAt !== 'undefined' && task.notifiedAt >= twentyFourHoursAgo) return false;
          
          return task.reminderAt < now.getTime();
        });

        userDetail.logs.push(`${overdueTasksToNotify.length} overdue tasks to notify`);

        if (overdueTasksToNotify.length > 0) {
          for (const task of overdueTasksToNotify) {
            
            const taskTitle = (task._doc && typeof task._doc.data === 'function' && task._doc.data().title) ? task._doc.data().title : 'Untitled Task';
            
            // Generate notification ID
            const notificationId = `notif_${userEmail.replace('@', '_').replace('.', '_')}_${Date.now()}_overdue`;
            
            // Before creating a new overdue notification, check if there's an existing unread
            // notification for the same task. If so, skip to avoid repeated notifications
            // until user has seen/read the previous one.
            try {
              const unreadQuery = await db
                .collection(`users/${userEmail}/notifications`)
                .where('relatedTaskId', '==', task._doc.id)
                .where('data.type', '==', 'overdue-task')
                .where('isRead', '==', false)
                .limit(1)
                .get();

              if (!unreadQuery.empty) {
                console.log(`Skipping overdue notification for task ${task._doc.id} because an unread notification already exists.`);
                continue;
              }
            } catch (checkErr) {
              console.error('Error checking existing unread overdue notifications:', checkErr);
              // If the check fails, fall back to original behaviour and proceed to notify
            }

            // Save notification to Firestore first
            const notificationData = {
              id: notificationId,
              userEmail,
              title: 'Task Overdue',
              body: `"${taskTitle}" is overdue!`,
              type: 'push',
              relatedTaskId: task._doc.id,
              isRead: false,
              createdAt: new Date(),
              data: {
                type: 'overdue-task',
                taskId: task._doc.id,
                title: taskTitle,
                timestamp: now.toISOString()
              },
            };
            
            await db.collection(`users/${userEmail}/notifications`).doc(notificationId).set(notificationData);
            console.log(`💾 Saved overdue notification to Firestore: ${notificationId}`);
            
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
                notificationId, // Include the Firestore notification ID
                userEmail,
                url: `/task/${task._doc.id}`,
                timestamp: now.toISOString()
              }
            };

            let successCount = 0;
            // Send to all user's devices
            for (const sub of subscriptions) {
              
              const result = await sendPushNotification(sub.data().subscription, payload);
              if (result.success) {
                results.totalNotificationsSent++;
                successCount++;
              } else if (result.error?.includes('410') || result.error?.includes('404')) {
                // Remove invalid subscription
                await db.collection('pushSubscriptions').doc(sub.id).delete();
              }
            }

            // Update notification with sent status if at least one was successful
            if (successCount > 0) {
              await db.collection(`users/${userEmail}/notifications`).doc(notificationId).update({ 
                sentAt: new Date() 
              });
              console.log(`📝 Updated overdue notification sentAt for ${notificationId}`);
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
        const RemindTasks = allTasks.filter((task: any) => {
                  return task.reminderAt !=  undefined;
                });
        // Only process tasks that have reminderAt field
        const tasksToRemind = RemindTasks.filter((task: any) => {
          if (typeof task.reminderAt !== 'number') return false;
          if (typeof task.completedAt !== 'undefined' && task.completedAt) return false;
          if (typeof task.lastRemindedAt !== 'undefined' && task.lastRemindedAt >= thirtyMinutesAgo) return false;
          if (task.onlyNotifyAtReminder) return false;

          return task.reminderAt > now.getTime() && task.reminderAt <= reminderTime;
        });

        for (const task of tasksToRemind as any[]) {
          
          const timeUntilDue = Math.round((task.reminderAt - now.getTime()) / (60 * 1000));
          const taskTitle = (task._doc && typeof task._doc.data === 'function' && task._doc.data().title) ? task._doc.data().title : 'Untitled Task';
          
          // Generate notification ID
          const notificationId = `notif_${userEmail.replace('@', '_').replace('.', '_')}_${Date.now()}_reminder`;
          
          // Save notification to Firestore first
          // Before creating a new reminder notification, check if there's an existing unread
          // reminder for the same task. If so, skip sending another reminder until the
          // user has seen/read the previous one.
          try {
            const unreadReminderQuery = await db
              .collection(`users/${userEmail}/notifications`)
              .where('relatedTaskId', '==', task._doc.id)
              .where('data.type', '==', 'task-reminder')
              .where('isRead', '==', false)
              .limit(1)
              .get();

            if (!unreadReminderQuery.empty) {
              console.log(`Skipping reminder for task ${task._doc.id} because an unread reminder notification already exists.`);
              continue;
            }
          } catch (checkErr) {
            console.error('Error checking existing unread reminder notifications:', checkErr);
            // Proceed with sending if the check fails
          }

          const notificationData = {
            id: notificationId,
            userEmail,
            title: 'Task Reminder',
            body: `"${taskTitle}" is due in ${timeUntilDue} minutes`,
            type: 'push',
            relatedTaskId: task._doc.id,
            isRead: false,
            createdAt: new Date(),
            data: {
              type: 'task-reminder',
              taskId: task._doc.id,
              title: taskTitle,
              timestamp: now.toISOString()
            },
          };
          
          await db.collection(`users/${userEmail}/notifications`).doc(notificationId).set(notificationData);
          console.log(`💾 Saved reminder notification to Firestore: ${notificationId}`);
          
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
              notificationId, // Include the Firestore notification ID
              userEmail,
              url: `/task/${task._doc.id}`,
              timestamp: now.toISOString()
            }
          };

          let successCount = 0;
          // Send to all user's devices
          for (const sub of subscriptions) {
            
            const result = await sendPushNotification(sub.data().subscription, payload);
            if (result.success) {
              results.totalNotificationsSent++;
              successCount++;
            } else if (result.error?.includes('410') || result.error?.includes('404')) {
              // Remove invalid subscription
              await db.collection('pushSubscriptions').doc(sub.id).delete();
            }
          }

          // Update notification with sent status if at least one was successful
          if (successCount > 0) {
            await db.collection(`users/${userEmail}/notifications`).doc(notificationId).update({ 
              sentAt: new Date() 
            });
            console.log(`📝 Updated reminder notification sentAt for ${notificationId}`);
          }

          // Update reminder timestamp
          await task._doc.ref.update({ lastRemindedAt: now.getTime() });
          results.reminderNotifications++;
        }
      }

      // Process milestone notifications
      try {
        userDetail.logs.push('Checking milestone notifications...');
        
        // Get user's milestones
        const milestonesSnapshot = await db
          .collection(`users/${userEmail}/milestones`)
          .where('isActive', '==', true)
          .get();

        if (!milestonesSnapshot.empty) {
          userDetail.logs.push(`Found ${milestonesSnapshot.docs.length} active milestones`);
          
          for (const milestoneDoc of milestonesSnapshot.docs) {
            const milestone = { id: milestoneDoc.id, ...milestoneDoc.data() };
            
            userDetail.logs.push(`Processing milestone: ${milestone.title} (isRecurring: ${milestone.isRecurring})`);
            console.log(`🔍 Processing milestone:`, {
              id: milestone.id,
              title: milestone.title,
              isRecurring: milestone.isRecurring,
              originalDate: milestone.originalDate,
              notificationSettings: milestone.notificationSettings
            });
            
            // Calculate days until next anniversary
            let daysUntil = null;
            if (milestone.isRecurring) {
              const originalDate = new Date(milestone.originalDate);
              const currentYear = now.getFullYear();
              
              userDetail.logs.push(`Original date: ${originalDate.toDateString()}, Current year: ${currentYear}`);
              
              // Calculate this year's anniversary
              let thisYearAnniversary = new Date(currentYear, originalDate.getMonth(), originalDate.getDate());
              
              // If this year's anniversary has passed, use next year's
              if (thisYearAnniversary < now) {
                thisYearAnniversary = new Date(currentYear + 1, originalDate.getMonth(), originalDate.getDate());
              }
              
              daysUntil = Math.floor((thisYearAnniversary.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              
              userDetail.logs.push(`Next anniversary: ${thisYearAnniversary.toDateString()}, Days until: ${daysUntil}`);
              console.log(`📅 Anniversary calculation:`, {
                originalDate: originalDate.toISOString(),
                thisYearAnniversary: thisYearAnniversary.toISOString(),
                daysUntil,
                now: now.toISOString()
              });
            }
            
            // Check if notification should be sent based on milestone settings
            let shouldNotify = false;
            let notificationType = '';
            
            userDetail.logs.push(`Checking notification rules for ${milestone.title}, daysUntil: ${daysUntil}`);
            
            if (daysUntil !== null) {
              console.log(`📋 Notification settings for ${milestone.title}:`, milestone.notificationSettings);
              
              if (daysUntil === 0 && milestone.notificationSettings?.onTheDay) {
                shouldNotify = true;
                notificationType = 'on-the-day';
                userDetail.logs.push(`✅ Should notify: On the day (${daysUntil} days)`);
              } else if (daysUntil === 1 && milestone.notificationSettings?.oneDayBefore) {
                shouldNotify = true;
                notificationType = 'one-day-before';
                userDetail.logs.push(`✅ Should notify: One day before (${daysUntil} days)`);
              } else if (daysUntil === 3 && milestone.notificationSettings?.threeDaysBefore) {
                shouldNotify = true;
                notificationType = 'three-days-before';
                userDetail.logs.push(`✅ Should notify: Three days before (${daysUntil} days)`);
              } else if (daysUntil === 7 && milestone.notificationSettings?.oneWeekBefore) {
                shouldNotify = true;
                notificationType = 'one-week-before';
                userDetail.logs.push(`✅ Should notify: One week before (${daysUntil} days)`);
              } else if (daysUntil === 30 && milestone.notificationSettings?.oneMonthBefore) {
                shouldNotify = true;
                notificationType = 'one-month-before';
                userDetail.logs.push(`✅ Should notify: One month before (${daysUntil} days)`);
              } else {
                userDetail.logs.push(`❌ No notification rule matches: daysUntil=${daysUntil}, settings enabled: onTheDay=${milestone.notificationSettings?.onTheDay}, oneDayBefore=${milestone.notificationSettings?.oneDayBefore}, threeDaysBefore=${milestone.notificationSettings?.threeDaysBefore}, oneWeekBefore=${milestone.notificationSettings?.oneWeekBefore}, oneMonthBefore=${milestone.notificationSettings?.oneMonthBefore}`);
              }
            } else {
              userDetail.logs.push(`❌ daysUntil is null (non-recurring milestone)`);
            }
            
            if (shouldNotify) {
              // Check if we already sent a notification for this milestone today
              const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const existingNotificationQuery = await db
                .collection(`users/${userEmail}/notifications`)
                .where('relatedMilestoneId', '==', milestone.id)
                .where('data.type', '==', 'milestone-reminder')
                .where('data.notificationType', '==', notificationType)
                .where('createdAt', '>=', todayStart)
                .limit(1)
                .get();

              if (existingNotificationQuery.empty) {
                // Generate notification content
                const typeInfoMap = {
                  birthday: { label: 'Birthday', icon: '🎂' },
                  anniversary: { label: 'Anniversary', icon: '💖' },
                  work_anniversary: { label: 'Work Anniversary', icon: '💼' },
                  graduation: { label: 'Graduation', icon: '🎓' },
                  exam_passed: { label: 'Exam Passed', icon: '📚' },
                  achievement: { label: 'Achievement', icon: '🏆' },
                  milestone: { label: 'Milestone', icon: '🎯' },
                  purchase: { label: 'Purchase', icon: '🛍️' },
                  relationship: { label: 'Relationship', icon: '❤️' },
                  travel: { label: 'Travel', icon: '✈️' },
                  custom: { label: 'Custom', icon: '⭐' },
                };
                
                const typeInfo = typeInfoMap[milestone.type as keyof typeof typeInfoMap] || { label: 'Milestone', icon: '⭐' };

                let title = '';
                let body = '';
                
                // Calculate years since original event
                const yearsSince = Math.floor((now.getTime() - milestone.originalDate) / (1000 * 60 * 60 * 24 * 365.25));
                
                if (daysUntil === 0) {
                  title = `${milestone.icon || typeInfo.icon} ${milestone.title}`;
                  body = milestone.isRecurring 
                    ? `Today marks ${yearsSince + 1} year${yearsSince + 1 !== 1 ? 's' : ''} since ${milestone.title}!`
                    : `Anniversary of ${milestone.title} (${yearsSince} year${yearsSince !== 1 ? 's' : ''} ago)`;
                } else {
                  const timeText = daysUntil === 1 ? 'tomorrow' : 
                                 daysUntil === 7 ? 'in 1 week' :
                                 daysUntil === 30 ? 'in 1 month' :
                                 `in ${daysUntil} days`;
                  
                  title = `${milestone.icon || typeInfo.icon} Upcoming ${typeInfo.label}`;
                  body = milestone.isRecurring
                    ? `${milestone.title} is ${timeText} (${yearsSince + 1} year${yearsSince + 1 !== 1 ? 's' : ''})`
                    : `${milestone.title} anniversary is ${timeText}`;
                }

                // Generate notification ID
                const notificationId = `notif_${userEmail.replace('@', '_').replace('.', '_')}_${Date.now()}_milestone`;
                
                // Save notification to Firestore
                const notificationData = {
                  id: notificationId,
                  userEmail,
                  title,
                  body,
                  type: 'push',
                  relatedMilestoneId: milestone.id,
                  isRead: false,
                  createdAt: new Date(),
                  data: {
                    type: 'milestone-reminder',
                    milestoneId: milestone.id,
                    milestoneTitle: milestone.title,
                    milestoneType: milestone.type,
                    notificationType,
                    daysUntil,
                    yearsSince: yearsSince + (daysUntil === 0 ? 1 : 0),
                    timestamp: now.toISOString()
                  },
                };
                
                await db.collection(`users/${userEmail}/notifications`).doc(notificationId).set(notificationData);
                console.log(`💾 Saved milestone notification to Firestore: ${notificationId}`);
                
                const payload = {
                  title,
                  body,
                  icon: '/icon-192.png',
                  badge: '/icon-192.png',
                  tag: `milestone-${milestone.id}-${notificationType}`,
                  data: {
                    type: 'milestone-reminder',
                    milestoneId: milestone.id,
                    notificationId,
                    userEmail,
                    url: `/milestones`,
                    timestamp: now.toISOString()
                  }
                };

                let successCount = 0;
                // Send to all user's devices
                for (const sub of subscriptions) {
                  const result = await sendPushNotification(sub.data().subscription, payload);
                  if (result.success) {
                    results.totalNotificationsSent++;
                    successCount++;
                  } else if (result.error?.includes('410') || result.error?.includes('404')) {
                    // Remove invalid subscription
                    await db.collection('pushSubscriptions').doc(sub.id).delete();
                  }
                }

                // Update notification with sent status if at least one was successful
                if (successCount > 0) {
                  await db.collection(`users/${userEmail}/notifications`).doc(notificationId).update({ 
                    sentAt: new Date() 
                  });
                  console.log(`📝 Updated milestone notification sentAt for ${notificationId}`);
                }

                // Update milestone with last notified timestamp
                await db.collection(`users/${userEmail}/milestones`).doc(milestone.id).update({ 
                  lastNotifiedAt: now.getTime() 
                });
                
                userDetail.logs.push(`Sent milestone notification: ${title}`);
                console.log(`🎉 Sent milestone notification for ${milestone.title} (${daysUntil} days until)`);
              } else {
                userDetail.logs.push(`Skipped milestone ${milestone.title} - already notified today`);
              }
            }
          }
        } else {
          userDetail.logs.push('No active milestones found');
        }
      } catch (milestoneError: any) {
        console.error(`Error processing milestones for user ${userEmail}:`, milestoneError);
        userDetail.errors.push(`Milestone processing error: ${milestoneError.message}`);
      }

      userDetail.status = 'processed';
      userDetail.notifications.total = userDetail.notifications.overdue + userDetail.notifications.reminders;
      userDetail.logs.push(`Completed processing: ${userDetail.notifications.total} notifications sent`);
      results.usersProcessed++;
      results.userDetails.push(userDetail);
      results.successLogs.push(`✅ User ${userEmail}: ${userDetail.notifications.total} notifications sent`);

    } catch (error: any) {
      userDetail.status = 'error';
      userDetail.errors.push(error.message);
      results.userDetails.push(userDetail);
      console.error(`Error processing notifications for user ${userEmail}:`, error);
      results.errors.push(`User ${userEmail}: ${error.message}`);
    }
  }

  // Generate comprehensive summary
  const endTime = new Date();
  results.summary = {
    totalUsers: preferencesSnapshot.docs.length,
    usersProcessed: results.usersProcessed,
    usersSkipped: results.usersSkipped,
    successRate: results.usersProcessed > 0 ? ((results.usersProcessed / (results.usersProcessed + results.usersSkipped)) * 100).toFixed(2) + '%' : '0%',
    notificationTypes: {
      overdue: results.overdueNotifications,
      reminders: results.reminderNotifications,
      total: results.totalNotificationsSent
    },
    subscriptions: {
      total: results.totalSubscriptionsProcessed,
      invalidRemoved: results.invalidSubscriptionsRemoved
    },
    executionTime: endTime.getTime() - now.getTime(),
    endTime: endTime.toISOString()
  };

  console.log('🔔 Push notifications processing completed:', results.summary);
  return results;
}

// Separate function for handling email digests
async function processEmailDigests(db: any, now: Date): Promise<any> {
  console.log('📧 Processing email digests...');
  
  const results = {
    type: 'email_digests',
    startTime: now.toISOString(),
    usersProcessed: 0,
    usersSkipped: 0,
    dailyDigestsSent: 0,
    weeklyDigestsSent: 0,
    emailErrors: 0,
    errors: [] as string[],
    successLogs: [] as string[],
    userDetails: [] as any[],
    summary: {} as any
  };

  // Get all users who have email preferences (independent of push notifications)
  const emailPreferencesSnapshot = await db.collection('emailPreferences').get();

  for (const emailPrefDoc of emailPreferencesSnapshot.docs) {
    const userEmail = emailPrefDoc.id;
    const emailPreferences = emailPrefDoc.data();

    const userDetail = {
      userEmail,
      preferences: {
        dailyDigest: emailPreferences.dailyDigest,
        weeklyDigest: emailPreferences.weeklyDigest,
        dailyDigestTime: emailPreferences.dailyDigestTime,
        digestDay: emailPreferences.digestDay,
        quietHours: emailPreferences.quietHours,
        lastDailySent: emailPreferences.lastDailySent,
        lastWeeklySent: emailPreferences.lastWeeklySent
      },
      status: '',
      digests: {
        daily: { shouldSend: false, sent: false, error: null as string | null },
        weekly: { shouldSend: false, sent: false, error: null as string | null }
      },
      logs: [] as string[],
      errors: [] as string[]
    };

    try {
      console.log(`📧 Checking email preferences for user: ${userEmail}`);
      userDetail.logs.push('Started email digest check');

      let digestsSent = 0;

      // Check if it's time to send daily digest
      const dailyCheck = await shouldSendDailyDigest(emailPreferences, now, db, userEmail);
      userDetail.digests.daily.shouldSend = dailyCheck.shouldSend;
      userDetail.logs.push(`Daily digest check: ${dailyCheck.reason}`);
      
      if (dailyCheck.shouldSend) {
        console.log(`📧 Time to send daily digest for user: ${userEmail} - ${dailyCheck.reason}`);
        
        // Check quiet hours for email
        if (!isInQuietHours(emailPreferences.quietHours)) {
          const dailyResult = await sendDailyDigestForUser(userEmail);
          userDetail.digests.daily.sent = dailyResult.success;
          
          if (dailyResult.success) {
            // Update the lastDailySent timestamp in emailPreferences
            try {
              await db.collection('emailPreferences').doc(userEmail).update({
                lastDailySent: new Date()
              });
              console.log(`📝 Updated lastDailySent for ${userEmail}`);
            } catch (updateError) {
              console.error('Error updating lastDailySent:', updateError);
            }
            
            results.dailyDigestsSent++;
            digestsSent++;
            userDetail.logs.push('✅ Daily digest sent successfully and timestamp updated');
            console.log(`✅ Daily digest sent to ${userEmail}`);
          } else {
            userDetail.digests.daily.error = dailyResult.error || 'Unknown error';
            results.emailErrors++;
            userDetail.errors.push(`Daily digest failed: ${dailyResult.error}`);
            results.errors.push(`Daily digest failed for ${userEmail}: ${dailyResult.error}`);
          }
        } else {
          userDetail.logs.push('🔇 Daily digest skipped - in quiet hours');
          console.log(`🔇 Skipping daily digest for ${userEmail} - in quiet hours`);
        }
      }

      // Check if it's time to send weekly digest
      const weeklyCheck = await shouldSendWeeklyDigest(emailPreferences, now, db, userEmail);
      userDetail.digests.weekly.shouldSend = weeklyCheck.shouldSend;
      userDetail.logs.push(`Weekly digest check: ${weeklyCheck.reason}`);
      
      if (weeklyCheck.shouldSend) {
        console.log(`📧 Time to send weekly digest for user: ${userEmail} - ${weeklyCheck.reason}`);
        
        // Check quiet hours for email
        if (!isInQuietHours(emailPreferences.quietHours)) {
          const weeklyResult = await sendWeeklyDigestForUser(userEmail);
          userDetail.digests.weekly.sent = weeklyResult.success;
          
          if (weeklyResult.success) {
            // Update the lastWeeklySent timestamp in emailPreferences
            try {
              await db.collection('emailPreferences').doc(userEmail).update({
                lastWeeklySent: new Date()
              });
              console.log(`📝 Updated lastWeeklySent for ${userEmail}`);
            } catch (updateError) {
              console.error('Error updating lastWeeklySent:', updateError);
            }
            
            results.weeklyDigestsSent++;
            digestsSent++;
            userDetail.logs.push('✅ Weekly digest sent successfully and timestamp updated');
            console.log(`✅ Weekly digest sent to ${userEmail}`);
          } else {
            userDetail.digests.weekly.error = weeklyResult.error || 'Unknown error';
            results.emailErrors++;
            userDetail.errors.push(`Weekly digest failed: ${weeklyResult.error}`);
            results.errors.push(`Weekly digest failed for ${userEmail}: ${weeklyResult.error}`);
          }
        } else {
          userDetail.logs.push('🔇 Weekly digest skipped - in quiet hours');
          console.log(`🔇 Skipping weekly digest for ${userEmail} - in quiet hours`);
        }
      }

      userDetail.status = digestsSent > 0 ? 'digests_sent' : 'no_digests_due';
      userDetail.logs.push(`Completed processing: ${digestsSent} digests sent`);
      results.usersProcessed++;
      results.userDetails.push(userDetail);
      
      if (digestsSent > 0) {
        results.successLogs.push(`✅ User ${userEmail}: ${digestsSent} digest(s) sent`);
      }

    } catch (emailError: any) {
      userDetail.status = 'error';
      userDetail.errors.push(emailError.message);
      results.userDetails.push(userDetail);
      console.error(`Error checking email digests for user ${userEmail}:`, emailError);
      results.emailErrors++;
      results.errors.push(`Email digest check failed for ${userEmail}: ${emailError.message}`);
    }
  }

  // Generate comprehensive summary
  const endTime = new Date();
  results.summary = {
    totalUsers: emailPreferencesSnapshot.docs.length,
    usersProcessed: results.usersProcessed,
    digestsSent: {
      daily: results.dailyDigestsSent,
      weekly: results.weeklyDigestsSent,
      total: results.dailyDigestsSent + results.weeklyDigestsSent
    },
    errors: {
      count: results.emailErrors,
      rate: results.usersProcessed > 0 ? ((results.emailErrors / results.usersProcessed) * 100).toFixed(2) + '%' : '0%'
    },
    successRate: results.usersProcessed > 0 ? (((results.usersProcessed - results.emailErrors) / results.usersProcessed) * 100).toFixed(2) + '%' : '0%',
    executionTime: endTime.getTime() - now.getTime(),
    endTime: endTime.toISOString()
  };

  console.log('📧 Email digests processing completed:', results.summary);
  return results;
}

// Main function that orchestrates both push notifications and email digests
async function executeNotificationCheck(): Promise<any> {
  console.log('🚀 Executing comprehensive notification and email digest check...');
  
  const db = getFirestore();
  const now = new Date();
  const startTime = now.getTime();
  
  // Run push notifications and email digests independently
  const [pushResults, emailResults] = await Promise.all([
    processPushNotifications(db, now),
    processEmailDigests(db, now)
  ]);

  const endTime = new Date();
  const totalExecutionTime = endTime.getTime() - startTime;

  // Create comprehensive combined results
  const combinedResults = {
    success: true,
    timestamp: now.toISOString(),
    executionTime: totalExecutionTime,
    
    // Overall summary
    overall: {
      totalUsersChecked: (pushResults.summary?.totalUsers || 0) + (emailResults.summary?.totalUsers || 0),
      totalUsersProcessed: pushResults.usersProcessed + emailResults.usersProcessed,
      totalErrors: pushResults.errors.length + emailResults.errors.length,
      executionTime: totalExecutionTime
    },

    // Push notifications detailed results
    pushNotifications: {
      ...pushResults,
      description: 'Push notification processing results with detailed user information'
    },

    // Email digests detailed results  
    emailDigests: {
      ...emailResults,
      description: 'Email digest processing results with detailed user information'
    },

    // Legacy compatibility (for existing integrations)
    usersProcessed: pushResults.usersProcessed + emailResults.usersProcessed,
    overdueNotifications: pushResults.overdueNotifications,
    reminderNotifications: pushResults.reminderNotifications,
    totalNotificationsSent: pushResults.totalNotificationsSent,
    dailyDigestsSent: emailResults.dailyDigestsSent,
    weeklyDigestsSent: emailResults.weeklyDigestsSent,
    emailErrors: emailResults.emailErrors,
    errors: [...pushResults.errors, ...emailResults.errors],

    // Comprehensive logs
    logs: {
      success: [...pushResults.successLogs, ...emailResults.successLogs],
      errors: [...pushResults.errors, ...emailResults.errors],
      combined: [
        ...pushResults.successLogs.map((log: string) => `[PUSH] ${log}`),
        ...emailResults.successLogs.map((log: string) => `[EMAIL] ${log}`),
        ...pushResults.errors.map((error: string) => `[PUSH ERROR] ${error}`),
        ...emailResults.errors.map((error: string) => `[EMAIL ERROR] ${error}`)
      ]
    }
  };

  console.log('🚀 Comprehensive notification check completed:', combinedResults.overall);
  return combinedResults;
}

async function startNotificationLoop() {
  if (await getLoopRunningState()) {
    console.log('Notification loop already running, skipping...');
    return { success: true, message: 'Loop already running' };
  }

  await setLoopRunningState(true);
  loopStartTime = new Date();
  
  console.log('Starting 30-minute notification loop...');
  
  const totalResults = {
    cycles: 0,
    totalUsersProcessed: 0,
    totalOverdueNotifications: 0,
    totalReminderNotifications: 0,
    totalNotificationsSent: 0,
    totalDailyDigestsSent: 0,
    totalWeeklyDigestsSent: 0,
    totalEmailErrors: 0,
    allErrors: [] as string[],
    startTime: loopStartTime.toISOString(),
    endTime: ''
  };

  try {
    // Run the loop for maximum Vercel timeout (58 minutes to be safe)
    const maxRunTime = 24 * 60 * 60 * 1000; // 24 hours
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxRunTime && (await getLoopRunningState())) {
      try {
        await setLoopRunningState(true);

        console.log(`Starting notification check cycle ${totalResults.cycles + 1}...`);
        const cycleStart = new Date();
        const cycleResults = await executeNotificationCheck();
        
        totalResults.cycles++;
        totalResults.totalUsersProcessed += cycleResults.usersProcessed;
        totalResults.totalOverdueNotifications += cycleResults.overdueNotifications;
        totalResults.totalReminderNotifications += cycleResults.reminderNotifications;
        totalResults.totalNotificationsSent += cycleResults.totalNotificationsSent;
        totalResults.totalDailyDigestsSent += cycleResults.dailyDigestsSent;
        totalResults.totalWeeklyDigestsSent += cycleResults.weeklyDigestsSent;
        totalResults.totalEmailErrors += cycleResults.emailErrors;
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
    await setLoopRunningState(false);
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
    const mode = url.searchParams.get('mode') || 'single'; // Default to loop mode

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
    await setLoopRunningState(false);
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

      // Generate notification ID
      const notificationId = `notif_${userEmail.replace('@', '_').replace('.', '_')}_${Date.now()}_test`;
      
      // Save test notification to Firestore
      const notificationData = {
        id: notificationId,
        userEmail,
        title: 'Test Notification',
        body: 'This is a test notification from MindMate.',
        type: 'push',
        relatedTaskId: null,
        isRead: false,
        createdAt: new Date(),
        data: {
          type: 'test',
          timestamp: new Date().toISOString()
        },
      };
      
      await db.collection(`users/${userEmail}/notifications`).doc(notificationId).set(notificationData);
      console.log(`💾 Saved test notification to Firestore: ${notificationId}`);

      const payload = {
        title: 'Test Notification',
        body: 'This is a test notification from MindMate.',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'test-notification',
        data: {
          type: 'test',
          notificationId, // Include the Firestore notification ID
          timestamp: new Date().toISOString()
        }
      };

      let successCount = 0;
      for (const sub of subscriptionsSnapshot.docs) {
        const result = await sendPushNotification(sub.data().subscription, payload);
        if (result.success) {
          totalSent++;
          successCount++;
        } else {
          errors.push(`User ${userEmail} sub ${sub.id}: ${result.error}`);
          if (result.error?.includes('410') || result.error?.includes('404')) {
            await db.collection('pushSubscriptions').doc(sub.id).delete();
          }
        }
      }

      // Update notification with sent status if at least one was successful
      if (successCount > 0) {
        await db.collection(`users/${userEmail}/notifications`).doc(notificationId).update({ 
          sentAt: new Date() 
        });
        console.log(`📝 Updated test notification sentAt for ${notificationId}`);
      }
    }

    return NextResponse.json({
      isLoopRunning: await getLoopRunningState(),
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
        isLoopRunning: await getLoopRunningState(),
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
  await setLoopRunningState(false);
  loopStartTime = null;
  console.log('Notification loop stopped by DELETE request.');
  return NextResponse.json({
    success: true,
    message: 'Notification loop stopped.'
  });
}