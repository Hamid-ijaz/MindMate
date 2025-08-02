import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';
import * as webpush from 'web-push';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@mindmate.app';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
} else {
  console.warn('⚠️ VAPID keys not configured. Push notifications will not work.');
}

// Types
interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: admin.firestore.Timestamp;
  reminderAt?: admin.firestore.Timestamp;
  notifiedAt?: admin.firestore.Timestamp;
  isCompleted: boolean;
  userId: string;
  priority?: 'low' | 'medium' | 'high';
  category?: string;
  recurrence?: {
    type: 'daily' | 'weekly' | 'monthly';
    interval: number;
    daysOfWeek?: number[];
    endDate?: admin.firestore.Timestamp;
  };
}

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId: string;
  isActive: boolean;
  deviceInfo?: {
    userAgent: string;
    platform: string;
    vendor: string;
  };
}

/**
 * Process overdue tasks for a specific user
 */
async function processUserOverdueTasks(userId: string, tasks: Task[]): Promise<void> {
  try {
    // Get user's active push subscriptions
    const subscriptionsSnapshot = await db.collection('pushSubscriptions')
      .where('userId', '==', userId)
      .where('isActive', '==', true)
      .get();
    
    if (subscriptionsSnapshot.empty) {
      console.log(`⚠️ No active subscriptions for user ${userId}`);
      return;
    }
    
    const subscriptions = subscriptionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as (PushSubscription & { id: string })[];
    
    // Filter tasks that need notifications
    const now = new Date();
    const tasksNeedingNotification = tasks.filter(task => {
      const dueDate = task.dueDate?.toDate();
      const lastNotified = task.notifiedAt?.toDate();
      
      if (!dueDate) return false;
      
      // Task must be overdue
      if (dueDate > now) return false;
      
      // If never notified, send notification
      if (!lastNotified) return true;
      
      // Send daily notifications for first 7 days after due date
      const daysSinceDue = Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
      const hoursSinceLastNotified = Math.floor((now.getTime() - lastNotified.getTime()) / (60 * 60 * 1000));
      
      return daysSinceDue <= 7 && hoursSinceLastNotified >= 24;
    });
    
    if (tasksNeedingNotification.length === 0) {
      console.log(`✅ No notifications needed for user ${userId}`);
      return;
    }
    
    console.log(`📤 Sending notifications for ${tasksNeedingNotification.length} tasks to user ${userId}`);
    
    // Create notification payload
    const notificationPayload = createNotificationPayload(tasksNeedingNotification);
    
    // Send notifications to all user's subscriptions
    const sendPromises = subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        }, JSON.stringify(notificationPayload));
        
        console.log(`✅ Notification sent to subscription ${subscription.id}`);
        return { success: true, subscriptionId: subscription.id };
      } catch (error) {
        console.error(`❌ Failed to send notification to subscription ${subscription.id}:`, error);
        
        // Handle invalid subscriptions
        if (error instanceof Error && (
          error.message.includes('410') || 
          error.message.includes('invalid')
        )) {
          // Mark subscription as inactive
          await db.collection('pushSubscriptions').doc(subscription.id).update({
            isActive: false,
            deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
            deactivationReason: 'invalid_subscription',
          });
          console.log(`🗑️ Marked subscription ${subscription.id} as inactive`);
        }
        
        return { success: false, subscriptionId: subscription.id, error };
      }
    });
    
    const results = await Promise.all(sendPromises);
    const successCount = results.filter(r => r.success).length;
    
    console.log(`📊 User ${userId}: ${successCount}/${subscriptions.length} notifications sent successfully`);
    
    // Update notifiedAt timestamp for all tasks that we attempted to notify about
    if (successCount > 0) {
      const batch = db.batch();
      
      tasksNeedingNotification.forEach(task => {
        const taskRef = db.collection('tasks').doc(task.id);
        batch.update(taskRef, {
          notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      
      await batch.commit();
      console.log(`📝 Updated notifiedAt for ${tasksNeedingNotification.length} tasks`);
    }
    
  } catch (error) {
    console.error(`❌ Error processing user ${userId}:`, error);
    throw error;
  }
}

/**
 * Create notification payload based on overdue tasks
 */
function createNotificationPayload(tasks: Task[]) {
  const taskCount = tasks.length;
  const urgentTasks = tasks.filter(task => task.priority === 'high');
  const now = new Date();
  
  let title: string;
  let body: string;
  
  if (taskCount === 1) {
    const task = tasks[0];
    const dueDate = task.dueDate?.toDate();
    const daysSinceDue = dueDate ? Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)) : 0;
    
    title = `📋 Overdue Task Reminder`;
    body = `"${task.title}" is ${daysSinceDue === 0 ? 'due today' : `${daysSinceDue} day${daysSinceDue > 1 ? 's' : ''} overdue`}`;
  } else {
    title = `📋 ${taskCount} Overdue Tasks`;
    
    if (urgentTasks.length > 0) {
      body = `You have ${taskCount} overdue tasks, including ${urgentTasks.length} high priority. Tap to review.`;
    } else {
      body = `You have ${taskCount} overdue tasks that need attention. Tap to review.`;
    }
  }
  
  return {
    title,
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'overdue-tasks',
    requireInteraction: true,
    timestamp: Date.now(),
    actions: [
      {
        action: 'view',
        title: '👀 View Tasks',
        icon: '/icon-192.png'
      },
      {
        action: 'dismiss',
        title: '❌ Dismiss',
        icon: '/icon-192.png'
      }
    ],
    data: {
      type: 'overdue-tasks',
      taskIds: tasks.map(t => t.id),
      timestamp: Date.now(),
      url: '/task', // Navigate to tasks page when clicked
    },
  };
}

/**
 * Vercel serverless function to check for overdue tasks and send notifications
 * This will be called by Vercel Cron Jobs every hour during business hours
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add basic security check - only allow POST requests from Vercel cron
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional: Add authentication header check for additional security
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.CRON_SECRET;
  
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('🔍 Starting scheduled overdue task check...');
  
  try {
    const now = new Date();
    
    // Get all overdue, incomplete tasks
    const tasksSnapshot = await db.collection('tasks')
      .where('isCompleted', '==', false)
      .where('dueDate', '<=', admin.firestore.Timestamp.fromDate(now))
      .limit(500) // Prevent overwhelming the system
      .get();
    
    if (tasksSnapshot.empty) {
      console.log('✅ No overdue tasks found');
      return res.status(200).json({
        success: true,
        message: 'No overdue tasks found',
        timestamp: new Date().toISOString(),
      });
    }
    
    const overdueTasks = tasksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Task[];
    
    console.log(`📋 Found ${overdueTasks.length} overdue tasks`);
    
    // Group tasks by user
    const tasksByUser = overdueTasks.reduce((acc, task) => {
      if (!acc[task.userId]) {
        acc[task.userId] = [];
      }
      acc[task.userId].push(task);
      return acc;
    }, {} as Record<string, Task[]>);
    
    const userIds = Object.keys(tasksByUser);
    console.log(`👥 Processing ${userIds.length} users`);
    
    // Process users in batches to avoid overwhelming Firebase
    const batchSize = 10;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      await Promise.all(batch.map(userId => processUserOverdueTasks(userId, tasksByUser[userId])));
    }
    
    console.log('🎉 Scheduled overdue task check completed');
    
    return res.status(200).json({
      success: true,
      message: 'Overdue task check completed successfully',
      tasksProcessed: overdueTasks.length,
      usersProcessed: userIds.length,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('❌ Error in scheduled overdue task check:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to check overdue tasks',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}
