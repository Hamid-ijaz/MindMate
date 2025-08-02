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
    
    title = `📋 Task Reminder`;
    body = `"${task.title}" ${daysSinceDue > 0 ? `is ${daysSinceDue} day${daysSinceDue > 1 ? 's' : ''} overdue` : 'is due today'}`;
  } else {
    title = `📋 ${taskCount} Task Reminders`;
    
    if (urgentTasks.length > 0) {
      body = `You have ${taskCount} tasks, including ${urgentTasks.length} high priority. Tap to review.`;
    } else {
      body = `You have ${taskCount} tasks that need attention. Tap to review.`;
    }
  }
  
  return {
    title,
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'task-reminder',
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
      type: 'task-reminder',
      taskIds: tasks.map(t => t.id),
      timestamp: Date.now(),
      url: '/task', // Navigate to tasks page when clicked
    },
  };
}

/**
 * Vercel serverless function to send immediate push notification for a specific task
 * This replaces the Firebase callable function
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { taskId, userId, authToken } = req.body;
    
    if (!taskId || !userId) {
      return res.status(400).json({ 
        error: 'taskId and userId are required' 
      });
    }

    // Note: In a real app, you should verify the authToken
    // For now, we'll assume the client sends a valid user ID
    // You can implement Firebase Auth token verification here
    
    // Get the task
    const taskDoc = await db.collection('tasks').doc(taskId).get();
    
    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const task = { id: taskDoc.id, ...taskDoc.data() } as Task;
    
    if (task.userId !== userId) {
      return res.status(403).json({ 
        error: 'Task does not belong to user' 
      });
    }
    
    // Get user's active push subscriptions
    const subscriptionsSnapshot = await db.collection('pushSubscriptions')
      .where('userId', '==', userId)
      .where('isActive', '==', true)
      .get();
    
    if (subscriptionsSnapshot.empty) {
      return res.status(412).json({ 
        error: 'No active push subscriptions found' 
      });
    }
    
    const subscriptions = subscriptionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as (PushSubscription & { id: string })[];
    
    // Create notification payload for single task
    const notificationPayload = createNotificationPayload([task]);
    
    // Send notifications
    const sendPromises = subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        }, JSON.stringify(notificationPayload));
        
        return { success: true, subscriptionId: subscription.id };
      } catch (error) {
        console.error(`Failed to send notification to subscription ${subscription.id}:`, error);
        return { success: false, subscriptionId: subscription.id, error };
      }
    });
    
    const results = await Promise.all(sendPromises);
    const successCount = results.filter(r => r.success).length;
    
    // Update task's notifiedAt timestamp
    await db.collection('tasks').doc(taskId).update({
      notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    return res.status(200).json({
      success: true,
      message: `Task reminder sent to ${successCount}/${subscriptions.length} devices`,
      notificationsSent: successCount,
      totalSubscriptions: subscriptions.length,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Error sending task reminder:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to send task reminder',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}
