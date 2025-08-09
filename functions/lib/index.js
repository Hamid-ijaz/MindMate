"use strict";
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTaskReminder = exports.triggerOverdueCheck = exports.checkOverdueTasks = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const webpush = require("web-push");
// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();
// Configure web-push with VAPID keys
const vapidPublicKey = (_a = functions.config().vapid) === null || _a === void 0 ? void 0 : _a.public_key;
const vapidPrivateKey = (_b = functions.config().vapid) === null || _b === void 0 ? void 0 : _b.private_key;
const vapidEmail = ((_c = functions.config().vapid) === null || _c === void 0 ? void 0 : _c.email) || 'mailto:admin@mindmate.app';
if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
}
else {
    console.warn('⚠️ VAPID keys not configured. Push notifications will not work.');
}
/**
 * Scheduled function to check for overdue tasks and send notifications
 * Runs every hour during business hours (8 AM - 10 PM)
 */
exports.checkOverdueTasks = functions.pubsub
    .schedule('0 8-22 * * *') // Every hour from 8 AM to 10 PM
    .timeZone('America/New_York') // Adjust timezone as needed
    .onRun(async (context) => {
    console.log('🔍 Starting scheduled overdue task check...');
    try {
        const now = new Date();
        // const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Removed unused variable
        // Get all overdue, incomplete tasks
        const tasksSnapshot = await db.collection('tasks')
            .where('isCompleted', '==', false)
            .where('dueDate', '<=', admin.firestore.Timestamp.fromDate(now))
            .limit(500) // Prevent overwhelming the system
            .get();
        if (tasksSnapshot.empty) {
            console.log('✅ No overdue tasks found');
            return null;
        }
        const overdueTasks = tasksSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        console.log(`📋 Found ${overdueTasks.length} overdue tasks`);
        // Group tasks by user
        const tasksByUser = overdueTasks.reduce((acc, task) => {
            if (!acc[task.userId]) {
                acc[task.userId] = [];
            }
            acc[task.userId].push(task);
            return acc;
        }, {});
        const userIds = Object.keys(tasksByUser);
        console.log(`👥 Processing ${userIds.length} users`);
        // Process users in batches to avoid overwhelming Firebase
        const batchSize = 10;
        for (let i = 0; i < userIds.length; i += batchSize) {
            const batch = userIds.slice(i, i + batchSize);
            await Promise.all(batch.map(userId => processUserOverdueTasks(userId, tasksByUser[userId])));
        }
        console.log('🎉 Scheduled overdue task check completed');
        return null;
    }
    catch (error) {
        console.error('❌ Error in scheduled overdue task check:', error);
        throw error;
    }
});
/**
 * Process overdue tasks for a specific user
 */
async function processUserOverdueTasks(userId, tasks) {
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
        const subscriptions = subscriptionsSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        // Filter tasks that need notifications
        const now = new Date();
        const tasksNeedingNotification = tasks.filter(task => {
            var _a, _b;
            const dueDate = (_a = task.dueDate) === null || _a === void 0 ? void 0 : _a.toDate();
            const lastNotified = (_b = task.notifiedAt) === null || _b === void 0 ? void 0 : _b.toDate();
            if (!dueDate)
                return false;
            // Task must be overdue
            if (dueDate > now)
                return false;
            // If never notified, send notification
            if (!lastNotified)
                return true;
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
            }
            catch (error) {
                console.error(`❌ Failed to send notification to subscription ${subscription.id}:`, error);
                // Handle invalid subscriptions
                if (error instanceof Error && (error.message.includes('410') ||
                    error.message.includes('invalid'))) {
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
    }
    catch (error) {
        console.error(`❌ Error processing user ${userId}:`, error);
        throw error;
    }
}
/**
 * Create notification payload based on overdue tasks
 */
function createNotificationPayload(tasks) {
    var _a;
    const taskCount = tasks.length;
    const urgentTasks = tasks.filter(task => task.priority === 'high');
    const now = new Date();
    let title;
    let body;
    if (taskCount === 1) {
        const task = tasks[0];
        const dueDate = (_a = task.dueDate) === null || _a === void 0 ? void 0 : _a.toDate();
        const daysSinceDue = dueDate ? Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)) : 0;
        title = `📋 Overdue Task Reminder`;
        body = `"${task.title}" is ${daysSinceDue === 0 ? 'due today' : `${daysSinceDue} day${daysSinceDue > 1 ? 's' : ''} overdue`}`;
    }
    else {
        title = `📋 ${taskCount} Overdue Tasks`;
        if (urgentTasks.length > 0) {
            body = `You have ${taskCount} overdue tasks, including ${urgentTasks.length} high priority. Tap to review.`;
        }
        else {
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
 * HTTP function to manually trigger overdue task check
 * Useful for testing and manual triggers
 */
exports.triggerOverdueCheck = functions.https.onRequest(async (req, res) => {
    // Add basic authentication/authorization here if needed
    try {
        console.log('🚀 Manual overdue task check triggered');
        // Call the same logic as the scheduled function
        await exports.checkOverdueTasks.run({}, {});
        res.json({
            success: true,
            message: 'Overdue task check completed successfully',
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('❌ Error in manual overdue task check:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check overdue tasks',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * Function to send immediate push notification for a specific task
 * Called when a task reminder is set or when user manually triggers
 */
exports.sendTaskReminder = functions.https.onCall(async (data, context) => {
    // Verify user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { taskId, userId } = data;
    if (!taskId || !userId) {
        throw new functions.https.HttpsError('invalid-argument', 'taskId and userId are required');
    }
    // Verify user can access this task
    if (context.auth.uid !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'User can only send reminders for their own tasks');
    }
    try {
        // Get the task
        const taskDoc = await db.collection('tasks').doc(taskId).get();
        if (!taskDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Task not found');
        }
        const task = Object.assign({ id: taskDoc.id }, taskDoc.data());
        if (task.userId !== userId) {
            throw new functions.https.HttpsError('permission-denied', 'Task does not belong to user');
        }
        // Get user's active push subscriptions
        const subscriptionsSnapshot = await db.collection('pushSubscriptions')
            .where('userId', '==', userId)
            .where('isActive', '==', true)
            .get();
        if (subscriptionsSnapshot.empty) {
            throw new functions.https.HttpsError('failed-precondition', 'No active push subscriptions found');
        }
        const subscriptions = subscriptionsSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
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
            }
            catch (error) {
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
        return {
            success: true,
            message: `Task reminder sent to ${successCount}/${subscriptions.length} devices`,
            notificationsSent: successCount,
            totalSubscriptions: subscriptions.length,
        };
    }
    catch (error) {
        console.error('Error sending task reminder:', error);
        throw new functions.https.HttpsError('internal', 'Failed to send task reminder');
    }
});
//# sourceMappingURL=index.js.map