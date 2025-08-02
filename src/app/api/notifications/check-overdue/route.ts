import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import webpush from 'web-push';

// Types
interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: Date;
  reminderAt?: Date;
  notifiedAt?: Date;
  isCompleted: boolean;
  userId: string;
  priority?: 'low' | 'medium' | 'high';
  category?: string;
  recurrence?: {
    type: 'daily' | 'weekly' | 'monthly';
    interval: number;
    daysOfWeek?: number[];
    endDate?: Date;
  };
}

interface PushSubscription {
  id: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId: string;
  isActive: boolean;
}

// Configure web-push
if (process.env.VAPID_PRIVATE_KEY && process.env.VAPID_PUBLIC_KEY) {
  webpush.setVapidDetails(
    'mailto:your-email@example.com', // Replace with your email
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Starting overdue task notification check...');
    
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Get all overdue tasks
    const tasksRef = collection(db, 'tasks');
    const overdueTasksQuery = query(
      tasksRef,
      where('isCompleted', '==', false),
      where('dueDate', '<=', now),
      orderBy('dueDate', 'asc'),
      limit(100) // Limit to prevent overwhelming
    );
    
    const overdueTasksSnapshot = await getDocs(overdueTasksQuery);
    const overdueTasks = overdueTasksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      dueDate: doc.data().dueDate?.toDate(),
      reminderAt: doc.data().reminderAt?.toDate(),
      notifiedAt: doc.data().notifiedAt?.toDate(),
    })) as Task[];
    
    console.log(`📋 Found ${overdueTasks.length} overdue tasks`);
    
    if (overdueTasks.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No overdue tasks found',
        processed: 0,
      });
    }
    
    // Group tasks by user
    const tasksByUser = overdueTasks.reduce((acc, task) => {
      if (!acc[task.userId]) {
        acc[task.userId] = [];
      }
      acc[task.userId].push(task);
      return acc;
    }, {} as Record<string, Task[]>);
    
    const userIds = Object.keys(tasksByUser);
    console.log(`👥 Processing ${userIds.length} users with overdue tasks`);
    
    // Get push subscriptions for all users with overdue tasks
    const subscriptionsRef = collection(db, 'pushSubscriptions');
    const subscriptionsQuery = query(
      subscriptionsRef,
      where('userId', 'in', userIds),
      where('isActive', '==', true)
    );
    
    const subscriptionsSnapshot = await getDocs(subscriptionsQuery);
    const subscriptions = subscriptionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as PushSubscription[];
    
    console.log(`📱 Found ${subscriptions.length} active push subscriptions`);
    
    // Group subscriptions by user
    const subscriptionsByUser = subscriptions.reduce((acc, sub) => {
      if (!acc[sub.userId]) {
        acc[sub.userId] = [];
      }
      acc[sub.userId].push(sub);
      return acc;
    }, {} as Record<string, PushSubscription[]>);
    
    let notificationsSent = 0;
    const errors: string[] = [];
    
    // Process each user's overdue tasks
    for (const userId of userIds) {
      const userTasks = tasksByUser[userId];
      const userSubscriptions = subscriptionsByUser[userId] || [];
      
      if (userSubscriptions.length === 0) {
        console.log(`⚠️ No active subscriptions for user ${userId}`);
        continue;
      }
      
      // Filter tasks that need notifications
      const tasksNeedingNotification = userTasks.filter(task => {
        const taskDueDate = task.dueDate;
        const lastNotified = task.notifiedAt;
        
        if (!taskDueDate) return false;
        
        // Task is overdue
        const isOverdue = taskDueDate <= now;
        
        if (!isOverdue) return false;
        
        // If never notified, send notification
        if (!lastNotified) return true;
        
        // If last notified more than 24 hours ago, send another notification
        // But only for the first 7 days after due date
        const daysSinceDue = Math.floor((now.getTime() - taskDueDate.getTime()) / (24 * 60 * 60 * 1000));
        const hoursSinceLastNotified = Math.floor((now.getTime() - lastNotified.getTime()) / (60 * 60 * 1000));
        
        return daysSinceDue <= 7 && hoursSinceLastNotified >= 24;
      });
      
      if (tasksNeedingNotification.length === 0) {
        console.log(`✅ No notifications needed for user ${userId}`);
        continue;
      }
      
      console.log(`📤 Sending notifications for ${tasksNeedingNotification.length} tasks to user ${userId}`);
      
      // Create notification content
      const notificationPayload = createNotificationPayload(tasksNeedingNotification);
      
      // Send notifications to all user's subscriptions
      for (const subscription of userSubscriptions) {
        try {
          await webpush.sendNotification({
            endpoint: subscription.endpoint,
            keys: subscription.keys,
          }, JSON.stringify(notificationPayload));
          
          notificationsSent++;
          console.log(`✅ Notification sent to subscription ${subscription.id}`);
        } catch (error) {
          const errorMsg = `Failed to send notification to subscription ${subscription.id}: ${error}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
          
          // If subscription is invalid, mark it as inactive
          if (error instanceof Error && error.message.includes('410')) {
            // TODO: Mark subscription as inactive in database
          }
        }
      }
      
      // Update notifiedAt timestamp for all notified tasks
      // This would typically be done in a batch update
      // For now, we'll log that it should be updated
      console.log(`📝 Should update notifiedAt for ${tasksNeedingNotification.length} tasks`);
    }
    
    console.log(`🎉 Notification check complete. Sent: ${notificationsSent}, Errors: ${errors.length}`);
    
    return NextResponse.json({
      success: true,
      message: 'Overdue task notification check completed',
      processed: overdueTasks.length,
      notificationsSent,
      errors: errors.length > 0 ? errors : undefined,
    });
    
  } catch (error) {
    console.error('Error checking overdue tasks:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to check overdue tasks',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function createNotificationPayload(tasks: Task[]) {
  const taskCount = tasks.length;
  const urgentTasks = tasks.filter(task => task.priority === 'high');
  
  let title: string;
  let body: string;
  
  if (taskCount === 1) {
    const task = tasks[0];
    const daysSinceDue = Math.floor((Date.now() - task.dueDate!.getTime()) / (24 * 60 * 60 * 1000));
    
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
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'UserId is required' },
        { status: 400 }
      );
    }
    
    const now = new Date();
    
    // Get user's overdue tasks
    const tasksRef = collection(db, 'tasks');
    const overdueTasksQuery = query(
      tasksRef,
      where('userId', '==', userId),
      where('isCompleted', '==', false),
      where('dueDate', '<=', now),
      orderBy('dueDate', 'asc')
    );
    
    const overdueTasksSnapshot = await getDocs(overdueTasksQuery);
    const overdueTasks = overdueTasksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      dueDate: doc.data().dueDate?.toDate(),
      reminderAt: doc.data().reminderAt?.toDate(),
      notifiedAt: doc.data().notifiedAt?.toDate(),
    }));
    
    return NextResponse.json({
      success: true,
      overdueTasks,
      count: overdueTasks.length,
    });
    
  } catch (error) {
    console.error('Error fetching overdue tasks:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch overdue tasks',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
