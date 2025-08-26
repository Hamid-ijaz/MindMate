import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email';
import { taskService, userService } from '@/lib/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userEmail, forceToday } = body;

    if (userEmail) {
      // Send digest for specific user
      const result = await sendWeeklyDigestForUser(userEmail);
      return NextResponse.json(result);
    } else {
      // Send digest for all eligible users
      const results = await sendWeeklyDigestForAllUsers(forceToday);
      return NextResponse.json(results);
    }
  } catch (error) {
    console.error('Error in weekly digest:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function sendWeeklyDigestForUser(userEmail: string) {
  try {
    // Check if user has weekly digest enabled
    const preferences = await getUserEmailPreferences(userEmail);
    if (!preferences?.weeklyDigest) {
      return { success: false, message: 'Weekly digest not enabled for user' };
    }

    // Get user info
    const user = await userService.getUser(userEmail);
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // Get weekly stats
    const weeklyStats = await getWeeklyStatsForUser(userEmail);

    // Generate and send email
    const templateData = {
      userName: user.name,
      userEmail,
      ...weeklyStats,
      companyName: process.env.EMAIL_COMPANY_NAME || 'MindMate',
      companyUrl: process.env.EMAIL_COMPANY_URL || 'https://mindmate.app',
      supportEmail: process.env.EMAIL_SUPPORT_EMAIL || 'support@mindmate.app',
    };

    const html = generateWeeklyDigestTemplate(templateData);
    const text = generateWeeklyDigestText(templateData);

    const success = await emailService.sendEmail({
      to: userEmail,
      subject: `📊 Your Weekly MindMate Summary`,
      html,
      text,
    });

    if (success) {
      // Log the digest send
      await logDigestSent(userEmail);
      return { success: true, message: 'Weekly digest sent successfully' };
    } else {
      return { success: false, message: 'Failed to send weekly digest' };
    }
  } catch (error) {
    console.error(`Error sending weekly digest for ${userEmail}:`, error);
    return { success: false, message: 'Error sending weekly digest' };
  }
}

async function sendWeeklyDigestForAllUsers(forceToday = false) {
  try {
    const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = dayNames[today];

    const db = getFirestore();
    
    // Get users who have weekly digest enabled and today is their digest day
    let query = db.collection('emailPreferences')
      .where('weeklyDigest', '==', true);

    if (!forceToday) {
      query = query.where('digestDay', '==', todayName);
    }

    const preferencesSnapshot = await query.get();
    
    const results = [];
    
    for (const doc of preferencesSnapshot.docs) {
      const userEmail = doc.id;
      const result = await sendWeeklyDigestForUser(userEmail);
      results.push({ userEmail, ...result });
    }

    const successCount = results.filter(r => r.success).length;

    return {
      success: true,
      message: `Processed ${results.length} users, ${successCount} digests sent successfully`,
      results,
    };
  } catch (error) {
    console.error('Error sending weekly digests:', error);
    return { success: false, message: 'Error sending weekly digests' };
  }
}

async function getUserEmailPreferences(userEmail: string) {
  try {
    const db = getFirestore();
    const doc = await db.collection('emailPreferences').doc(userEmail).get();
    return doc.exists ? doc.data() : null;
  } catch (error) {
    console.error('Error getting user preferences:', error);
    return null;
  }
}

async function getWeeklyStatsForUser(userEmail: string) {
  try {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get all tasks for the user
    const tasks = await taskService.getTasks(userEmail);
    
    // Filter tasks from the last week
    const thisWeekTasks = tasks.filter((task: any) => {
      const createdAt = task.createdAt?.toDate ? task.createdAt.toDate() : new Date(task.createdAt);
      return createdAt >= oneWeekAgo;
    });

    const completedTasks = tasks.filter((task: any) => task.completed);
    const thisWeekCompleted = thisWeekTasks.filter((task: any) => task.completed);
    const overdueTasks = tasks.filter((task: any) => {
      if (!task.dueDate || task.completed) return false;
      const dueDate = task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
      return dueDate < now;
    });

    // Get upcoming tasks (next 7 days)
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingTasks = tasks.filter((task: any) => {
      if (!task.dueDate || task.completed) return false;
      const dueDate = task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
      return dueDate >= now && dueDate <= nextWeek;
    });

    // Calculate productivity metrics
    const totalTasks = tasks.length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

    // Get priority breakdown
    const priorityBreakdown = {
      high: tasks.filter((task: any) => task.priority === 'high').length,
      medium: tasks.filter((task: any) => task.priority === 'medium').length,
      low: tasks.filter((task: any) => task.priority === 'low').length,
    };

    return {
      weekPeriod: `${oneWeekAgo.toLocaleDateString()} - ${now.toLocaleDateString()}`,
      totalTasks,
      thisWeekTasks: thisWeekTasks.length,
      thisWeekCompleted: thisWeekCompleted.length,
      completedTasks: completedTasks.length,
      overdueTasks: overdueTasks.length,
      upcomingTasks: upcomingTasks.slice(0, 5), // Top 5 upcoming tasks
      completionRate,
      priorityBreakdown,
    };
  } catch (error) {
    console.error('Error getting weekly stats:', error);
    return {
      totalTasks: 0,
      thisWeekTasks: 0,
      thisWeekCompleted: 0,
      completedTasks: 0,
      overdueTasks: 0,
      upcomingTasks: [],
      completionRate: 0,
      priorityBreakdown: { high: 0, medium: 0, low: 0 },
    };
  }
}

function generateWeeklyDigestTemplate(data: any): string {
  const companyName = data.companyName || 'MindMate';
  const upcomingTasksList = data.upcomingTasks.map((task: any) => 
    `<li>${task.title} ${task.dueDate ? `(Due: ${new Date(task.dueDate).toLocaleDateString()})` : ''}</li>`
  ).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weekly Summary</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .stat-box { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #3b82f6; }
        .stat-row { display: flex; justify-content: space-between; align-items: center; margin: 10px 0; }
        .stat-number { font-size: 24px; font-weight: bold; color: #3b82f6; }
        .priority-bar { height: 8px; background: #e2e8f0; border-radius: 4px; margin: 5px 0; }
        .priority-fill { height: 100%; border-radius: 4px; }
        .high { background: #ef4444; } .medium { background: #f59e0b; } .low { background: #10b981; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Your Weekly Summary</h1>
            <p>${companyName} | ${data.weekPeriod}</p>
        </div>
        <div class="content">
            <h2>Hello ${data.userName}! 👋</h2>
            <p>Here's how you did this week with your tasks and productivity:</p>
            
            <div class="stat-box">
                <h3>📈 This Week's Activity</h3>
                <div class="stat-row">
                    <span>Tasks Created</span>
                    <span class="stat-number">${data.thisWeekTasks}</span>
                </div>
                <div class="stat-row">
                    <span>Tasks Completed</span>
                    <span class="stat-number">${data.thisWeekCompleted}</span>
                </div>
                <div class="stat-row">
                    <span>Overall Completion Rate</span>
                    <span class="stat-number">${data.completionRate}%</span>
                </div>
            </div>

            <div class="stat-box">
                <h3>📋 Current Status</h3>
                <div class="stat-row">
                    <span>Total Tasks</span>
                    <span class="stat-number">${data.totalTasks}</span>
                </div>
                <div class="stat-row">
                    <span>Completed Tasks</span>
                    <span class="stat-number">${data.completedTasks}</span>
                </div>
                ${data.overdueTasks > 0 ? `
                <div class="stat-row">
                    <span>⚠️ Overdue Tasks</span>
                    <span class="stat-number" style="color: #ef4444;">${data.overdueTasks}</span>
                </div>
                ` : ''}
            </div>

            ${data.upcomingTasks.length > 0 ? `
            <div class="stat-box">
                <h3>📅 Upcoming Tasks</h3>
                <ul>${upcomingTasksList}</ul>
            </div>
            ` : ''}

            <div class="stat-box">
                <h3>🎯 Priority Breakdown</h3>
                <div style="margin: 15px 0;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>High Priority</span>
                        <span>${data.priorityBreakdown.high}</span>
                    </div>
                    <div class="priority-bar"><div class="priority-fill high" style="width: ${data.totalTasks > 0 ? (data.priorityBreakdown.high / data.totalTasks) * 100 : 0}%;"></div></div>
                </div>
                <div style="margin: 15px 0;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>Medium Priority</span>
                        <span>${data.priorityBreakdown.medium}</span>
                    </div>
                    <div class="priority-bar"><div class="priority-fill medium" style="width: ${data.totalTasks > 0 ? (data.priorityBreakdown.medium / data.totalTasks) * 100 : 0}%;"></div></div>
                </div>
                <div style="margin: 15px 0;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>Low Priority</span>
                        <span>${data.priorityBreakdown.low}</span>
                    </div>
                    <div class="priority-bar"><div class="priority-fill low" style="width: ${data.totalTasks > 0 ? (data.priorityBreakdown.low / data.totalTasks) * 100 : 0}%;"></div></div>
                </div>
            </div>

            ${data.completionRate >= 80 ? `
            <div class="stat-box" style="border-left-color: #10b981; background: #f0fdf4;">
                <h3>🎉 Great Job!</h3>
                <p>You're doing amazing with a ${data.completionRate}% completion rate! Keep up the excellent work!</p>
            </div>
            ` : data.completionRate >= 50 ? `
            <div class="stat-box" style="border-left-color: #f59e0b; background: #fffbeb;">
                <h3>👍 Good Progress!</h3>
                <p>You're making good progress! Consider focusing on completing those overdue tasks to boost your productivity.</p>
            </div>
            ` : `
            <div class="stat-box" style="border-left-color: #ef4444; background: #fef2f2;">
                <h3>💪 Let's Improve!</h3>
                <p>There's room for improvement! Try breaking down large tasks into smaller, manageable pieces.</p>
            </div>
            `}

            <p style="text-align: center; margin-top: 30px;">
                <a href="${data.companyUrl}" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">Open ${companyName}</a>
            </p>
            
            <p>Keep up the great work!<br>
            The ${companyName} Team</p>
        </div>
        <div class="footer">
            <p>This weekly summary was generated automatically from your ${companyName} activity.</p>
            <p><a href="${data.companyUrl}/settings">Manage Email Preferences</a></p>
            <p>© 2025 ${companyName}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
  `;
}

function generateWeeklyDigestText(data: any): string {
  const companyName = data.companyName || 'MindMate';
  const upcomingTasksList = data.upcomingTasks.map((task: any) => 
    `• ${task.title} ${task.dueDate ? `(Due: ${new Date(task.dueDate).toLocaleDateString()})` : ''}`
  ).join('\n');

  return `
Your Weekly Summary - ${companyName}
${data.weekPeriod}

Hello ${data.userName}!

Here's how you did this week:

📈 THIS WEEK'S ACTIVITY
• Tasks Created: ${data.thisWeekTasks}
• Tasks Completed: ${data.thisWeekCompleted}
• Overall Completion Rate: ${data.completionRate}%

📋 CURRENT STATUS
• Total Tasks: ${data.totalTasks}
• Completed Tasks: ${data.completedTasks}
${data.overdueTasks > 0 ? `• ⚠️ Overdue Tasks: ${data.overdueTasks}` : ''}

${data.upcomingTasks.length > 0 ? `
📅 UPCOMING TASKS
${upcomingTasksList}
` : ''}

🎯 PRIORITY BREAKDOWN
• High Priority: ${data.priorityBreakdown.high}
• Medium Priority: ${data.priorityBreakdown.medium}
• Low Priority: ${data.priorityBreakdown.low}

${data.completionRate >= 80 ? 
  '🎉 Great Job! You\'re doing amazing!' : 
  data.completionRate >= 50 ? 
    '👍 Good Progress! Keep it up!' : 
    '💪 Let\'s Improve! You can do it!'
}

Open ${companyName}: ${data.companyUrl}

Keep up the great work!
The ${companyName} Team

Manage preferences: ${data.companyUrl}/settings
  `;
}

async function logDigestSent(userEmail: string) {
  try {
    const db = getFirestore();
    await db.collection('emailDigestLog').add({
      userEmail,
      sentAt: new Date(),
      type: 'weekly',
    });
  } catch (error) {
    console.error('Error logging digest:', error);
  }
}
