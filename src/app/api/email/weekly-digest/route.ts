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
      userName: user.firstName || 'there',
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
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Get all tasks for the user
    const tasks = await taskService.getTasks(userEmail);
    
    // Filter tasks from the last week
    const thisWeekTasks = tasks.filter((task: any) => {
      const createdAt = task.createdAt?.toDate ? task.createdAt.toDate() : new Date(task.createdAt);
      return createdAt >= oneWeekAgo;
    });

    // Filter tasks from the previous week for comparison
    const lastWeekTasks = tasks.filter((task: any) => {
      const createdAt = task.createdAt?.toDate ? task.createdAt.toDate() : new Date(task.createdAt);
      return createdAt >= twoWeeksAgo && createdAt < oneWeekAgo;
    });

    const completedTasks = tasks.filter((task: any) => task.completed);
    const thisWeekCompleted = tasks.filter((task: any) => {
      if (!task.completedAt) return false;
      const completedAt = task.completedAt?.toDate ? task.completedAt.toDate() : new Date(task.completedAt);
      return completedAt >= oneWeekAgo;
    });

    const lastWeekCompleted = tasks.filter((task: any) => {
      if (!task.completedAt) return false;
      const completedAt = task.completedAt?.toDate ? task.completedAt.toDate() : new Date(task.completedAt);
      return completedAt >= twoWeeksAgo && completedAt < oneWeekAgo;
    });

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
    const activeTasks = tasks.filter((task: any) => !task.completed).length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;
    const thisWeekCompletionRate = thisWeekTasks.length > 0 ? Math.round((thisWeekCompleted.length / thisWeekTasks.length) * 100) : 0;

    // Calculate trends
    const taskCreationTrend = thisWeekTasks.length - lastWeekTasks.length;
    const completionTrend = thisWeekCompleted.length - lastWeekCompleted.length;

    // Get priority breakdown for active tasks
    const priorityBreakdown = {
      high: tasks.filter((task: any) => task.priority === 'high' && !task.completed).length,
      medium: tasks.filter((task: any) => task.priority === 'medium' && !task.completed).length,
      low: tasks.filter((task: any) => task.priority === 'low' && !task.completed).length,
    };

    // Category breakdown (if tasks have categories)
    const categoryBreakdown = tasks.reduce((acc: any, task: any) => {
      if (!task.completed && task.category) {
        acc[task.category] = (acc[task.category] || 0) + 1;
      }
      return acc;
    }, {});

    // Get top categories (top 3)
    const topCategories = Object.entries(categoryBreakdown)
      .sort(([,a]: any, [,b]: any) => b - a)
      .slice(0, 3)
      .map(([category, count]) => ({ category, count }));

    // Productivity insights
    const getProductivityInsight = () => {
      if (thisWeekCompleted.length === 0) {
        return "Time to get started! Every completed task is a step toward your goals. 🌟";
      } else if (thisWeekCompletionRate >= 80) {
        return "Incredible productivity this week! You're absolutely crushing your goals! 🚀";
      } else if (thisWeekCompletionRate >= 60) {
        return "Great work this week! You're building excellent momentum! 💪";
      } else if (completionTrend > 0) {
        return "Nice improvement! You're moving in the right direction! 📈";
      } else {
        return "Every day is a new opportunity. You've got this! ✨";
      }
    };

    // Weekly focus recommendation
    const getFocusRecommendation = () => {
      if (overdueTasks.length > 5) {
        return "Focus on clearing overdue tasks first - tackle 2-3 each day this week.";
      } else if (priorityBreakdown.high > 0) {
        return `You have ${priorityBreakdown.high} high-priority tasks. Consider focusing on these first.`;
      } else if (upcomingTasks.length > 10) {
        return "You have a busy week ahead! Consider time-blocking your schedule.";
      } else {
        return "Perfect time to tackle some long-term goals or learn something new!";
      }
    };

    return {
      weekPeriod: `${oneWeekAgo.toLocaleDateString()} - ${now.toLocaleDateString()}`,
      totalTasks,
      activeTasks,
      thisWeekTasks: thisWeekTasks.length,
      thisWeekCompleted: thisWeekCompleted.length,
      thisWeekCompletionRate,
      completedTasks: completedTasks.length,
      overdueTasks: overdueTasks.length,
      upcomingTasks: upcomingTasks.slice(0, 5), // Top 5 upcoming tasks
      completionRate,
      priorityBreakdown,
      taskCreationTrend,
      completionTrend,
      topCategories,
      productivityInsight: getProductivityInsight(),
      focusRecommendation: getFocusRecommendation(),
      streakData: {
        currentStreak: calculateCurrentStreak(tasks),
        longestStreak: calculateLongestStreak(tasks),
      }
    };
  } catch (error) {
    console.error('Error getting weekly stats:', error);
    return {
      weekPeriod: `${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString()} - ${new Date().toLocaleDateString()}`,
      totalTasks: 0,
      activeTasks: 0,
      thisWeekTasks: 0,
      thisWeekCompleted: 0,
      thisWeekCompletionRate: 0,
      completedTasks: 0,
      overdueTasks: 0,
      upcomingTasks: [],
      completionRate: 0,
      priorityBreakdown: { high: 0, medium: 0, low: 0 },
      taskCreationTrend: 0,
      completionTrend: 0,
      topCategories: [],
      productivityInsight: "Keep going! Every day is a new opportunity! 🌟",
      focusRecommendation: "Start small and build momentum with your tasks.",
      streakData: { currentStreak: 0, longestStreak: 0 }
    };
  }
}

// Helper functions for streak calculation
function calculateCurrentStreak(tasks: any[]): number {
  const completedTasks = tasks
    .filter((task: any) => task.completedAt)
    .sort((a: any, b: any) => {
      const aDate = a.completedAt?.toDate ? a.completedAt.toDate() : new Date(a.completedAt);
      const bDate = b.completedAt?.toDate ? b.completedAt.toDate() : new Date(b.completedAt);
      return bDate.getTime() - aDate.getTime();
    });

  if (completedTasks.length === 0) return 0;

  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  for (const task of completedTasks) {
    const taskDate = task.completedAt?.toDate ? task.completedAt.toDate() : new Date(task.completedAt);
    taskDate.setHours(0, 0, 0, 0);

    if (taskDate.getTime() === currentDate.getTime()) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else if (taskDate.getTime() < currentDate.getTime()) {
      break;
    }
  }

  return streak;
}

function calculateLongestStreak(tasks: any[]): number {
  const completedTasks = tasks
    .filter((task: any) => task.completedAt)
    .sort((a: any, b: any) => {
      const aDate = a.completedAt?.toDate ? a.completedAt.toDate() : new Date(a.completedAt);
      const bDate = b.completedAt?.toDate ? b.completedAt.toDate() : new Date(b.completedAt);
      return aDate.getTime() - bDate.getTime();
    });

  if (completedTasks.length === 0) return 0;

  let maxStreak = 1;
  let currentStreak = 1;
  
  for (let i = 1; i < completedTasks.length; i++) {
    const prevDate = completedTasks[i - 1].completedAt?.toDate ? 
      completedTasks[i - 1].completedAt.toDate() : new Date(completedTasks[i - 1].completedAt);
    const currDate = completedTasks[i].completedAt?.toDate ? 
      completedTasks[i].completedAt.toDate() : new Date(completedTasks[i].completedAt);
    
    prevDate.setHours(0, 0, 0, 0);
    currDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000));
    
    if (diffDays === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

}

function generateWeeklyDigestTemplate(data: any): string {
  const companyName = data.companyName || 'MindMate';
  const companyUrl = data.companyUrl || 'https://mindmate.app';
  
  const upcomingTasksList = data.upcomingTasks.map((task: any) => 
    `<li style="margin: 5px 0; padding: 8px; background: #ecfdf5; border-radius: 4px;">
      <strong>${task.title}</strong>
      ${task.dueDate ? `<br><small style="color: #10b981;">Due: ${new Date(task.dueDate).toLocaleDateString()}</small>` : ''}
    </li>`
  ).join('');

  const topCategoriesList = data.topCategories.map((cat: any) => 
    `<div style="display: flex; justify-content: space-between; margin: 5px 0;">
      <span>${cat.category}</span>
      <strong>${cat.count} tasks</strong>
    </div>`
  ).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weekly Summary - ${data.weekPeriod}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat-card { background: #f8f9ff; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #3b82f6; }
        .stat-number { font-size: 24px; font-weight: bold; color: #3b82f6; }
        .stat-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
        .trend-indicator { font-size: 14px; margin-top: 5px; }
        .trend-up { color: #10b981; }
        .trend-down { color: #ef4444; }
        .trend-neutral { color: #6b7280; }
        .section { margin: 25px 0; padding: 20px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #10b981; }
        .section-title { font-size: 18px; font-weight: bold; color: #1f2937; margin-bottom: 10px; }
        .task-list { list-style: none; padding: 0; margin: 10px 0; }
        .priority-bar { display: flex; align-items: center; margin: 10px 0; }
        .priority-label { width: 80px; font-size: 14px; }
        .priority-count { font-weight: bold; margin-left: 10px; }
        .insight-box { background: linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0; }
        .recommendation-box { background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #1f2937; padding: 20px; border-radius: 10px; margin: 20px 0; }
        .streak-section { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .overdue-warning { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 15px; border-radius: 6px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Weekly Summary</h1>
            <p>Your ${companyName} productivity report</p>
            <p style="font-size: 14px; opacity: 0.9;">${data.weekPeriod}</p>
        </div>
        <div class="content">
            <h2>Hello ${data.userName}! 👋</h2>
            <p>Here's how you performed this week and what's coming up:</p>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${data.thisWeekCompleted}</div>
                    <div class="stat-label">Completed This Week</div>
                    <div class="trend-indicator ${data.completionTrend > 0 ? 'trend-up' : data.completionTrend < 0 ? 'trend-down' : 'trend-neutral'}">
                        ${data.completionTrend > 0 ? '↗️' : data.completionTrend < 0 ? '↘️' : '➡️'} 
                        ${data.completionTrend > 0 ? '+' : ''}${data.completionTrend} vs last week
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${data.thisWeekTasks}</div>
                    <div class="stat-label">Created This Week</div>
                    <div class="trend-indicator ${data.taskCreationTrend > 0 ? 'trend-up' : data.taskCreationTrend < 0 ? 'trend-down' : 'trend-neutral'}">
                        ${data.taskCreationTrend > 0 ? '↗️' : data.taskCreationTrend < 0 ? '↘️' : '➡️'} 
                        ${data.taskCreationTrend > 0 ? '+' : ''}${data.taskCreationTrend} vs last week
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${data.thisWeekCompletionRate}%</div>
                    <div class="stat-label">Weekly Completion Rate</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${data.activeTasks}</div>
                    <div class="stat-label">Active Tasks</div>
                </div>
            </div>

            ${data.overdueTasks > 0 ? `
            <div class="overdue-warning">
                <strong>⚠️ Attention:</strong> You have ${data.overdueTasks} overdue task${data.overdueTasks > 1 ? 's' : ''}. 
                Consider prioritizing these to get back on track!
            </div>
            ` : ''}

            ${data.streakData && (data.streakData.currentStreak > 0 || data.streakData.longestStreak > 0) ? `
            <div class="streak-section">
                <h3 style="margin: 0 0 10px 0;">🔥 Productivity Streak</h3>
                <div style="display: flex; justify-content: space-around; text-align: center;">
                    <div>
                        <div style="font-size: 24px; font-weight: bold;">${data.streakData.currentStreak}</div>
                        <div style="font-size: 14px; opacity: 0.9;">Current Streak</div>
                    </div>
                    <div>
                        <div style="font-size: 24px; font-weight: bold;">${data.streakData.longestStreak}</div>
                        <div style="font-size: 14px; opacity: 0.9;">Longest Streak</div>
                    </div>
                </div>
            </div>
            ` : ''}

            <div class="insight-box">
                <h3 style="margin: 0 0 10px 0;">✨ Productivity Insight</h3>
                <p style="margin: 0; font-size: 16px;">${data.productivityInsight}</p>
            </div>

            <div class="recommendation-box">
                <h3 style="margin: 0 0 10px 0; color: #1f2937;">🎯 Focus Recommendation</h3>
                <p style="margin: 0; color: #1f2937;">${data.focusRecommendation}</p>
            </div>

            ${data.upcomingTasks && data.upcomingTasks.length > 0 ? `
            <div class="section">
                <div class="section-title">📅 Upcoming Tasks (Next 7 Days)</div>
                <ul class="task-list">
                    ${upcomingTasksList}
                </ul>
                ${data.upcomingTasks.length >= 5 ? '<p><small>...and more in your dashboard</small></p>' : ''}
            </div>
            ` : ''}

            <div class="section">
                <div class="section-title">🎯 Priority Breakdown (Active Tasks)</div>
                <div class="priority-bar">
                    <span class="priority-label">🔴 High:</span>
                    <span class="priority-count">${data.priorityBreakdown.high}</span>
                </div>
                <div class="priority-bar">
                    <span class="priority-label">🟡 Medium:</span>
                    <span class="priority-count">${data.priorityBreakdown.medium}</span>
                </div>
                <div class="priority-bar">
                    <span class="priority-label">🟢 Low:</span>
                    <span class="priority-count">${data.priorityBreakdown.low}</span>
                </div>
            </div>

            ${data.topCategories && data.topCategories.length > 0 ? `
            <div class="section">
                <div class="section-title">📊 Top Categories (Active Tasks)</div>
                ${topCategoriesList}
            </div>
            ` : ''}

            <p style="text-align: center;">
                <a href="${companyUrl}" class="button">Open ${companyName}</a>
                <a href="${companyUrl}/calendar" class="button">View Calendar</a>
                <a href="${companyUrl}/timer" class="button">Start Focus Session</a>
            </p>

            <p>Keep up the excellent work! Every completed task brings you closer to your goals.</p>
            
            <p>Best regards,<br>
            The ${companyName} Team</p>
        </div>
        <div class="footer">
            <p>© 2025 ${companyName}. All rights reserved.</p>
            <p><a href="${companyUrl}/settings">Manage preferences</a> | <a href="mailto:${data.supportEmail}">Contact Support</a></p>
        </div>
    </div>
</body>
</html>
  `;
}

function generateWeeklyDigestTextTemplate(data: any): string {
  return `
📊 WEEKLY SUMMARY - ${data.weekPeriod}

Hello ${data.userName}! 👋

Here's how you performed this week:

📈 THIS WEEK'S ACTIVITY:
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
