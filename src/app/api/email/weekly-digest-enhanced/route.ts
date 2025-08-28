import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { taskService, userService } from '@/lib/firestore';
import { emailService } from '@/lib/email';

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

async function logDigestSent(userEmail: string) {
  try {
    const db = getFirestore();
    await db.collection('emailLogs').add({
      userEmail,
      type: 'weekly-digest',
      sentAt: new Date(),
    });
  } catch (error) {
    console.error('Error logging digest send:', error);
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
      subject: `📊 Your Weekly MindMate Summary - ${templateData.weekPeriod}`,
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

async function getWeeklyStatsForUser(userEmail: string) {
  try {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Get all tasks for the user
    const tasks = await taskService.getTasks(userEmail);
    
    // THIS WEEK'S ACCOMPLISHMENTS - Tasks completed this week
    const thisWeekCompleted = tasks.filter((task: any) => {
      if (!task.completedAt) return false;
      const completedAt = task.completedAt?.toDate ? task.completedAt.toDate() : new Date(task.completedAt);
      return completedAt >= oneWeekAgo;
    });

    // WEEK OVERVIEW - Simple key metrics
    const totalActiveTasks = tasks.filter((task: any) => !task.completedAt).length;
    const overallCompletionRate = tasks.length > 0 ? 
      Math.round((tasks.filter((t: any) => t.completedAt).length / tasks.length) * 100) : 0;

    // OLDER PENDING TASKS - Tasks pending for more than a week (KEY IMPROVEMENT)
    const oneWeekAgoTime = oneWeekAgo.getTime();
    const olderPendingTasks = tasks.filter((task: any) => {
      if (task.completedAt) return false;
      
      // Check creation date
      const createdAt = task.createdAt?.toDate ? task.createdAt.toDate() : new Date(task.createdAt);
      const createdAtTime = createdAt.getTime();
      
      // Check if due date is also old (if exists)
      let isDueOld = false;
      if (task.dueDate) {
        const dueDate = task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
        isDueOld = dueDate.getTime() < oneWeekAgoTime;
      }
      
      // Task is old if it was created more than a week ago OR due more than a week ago
      return createdAtTime < oneWeekAgoTime || isDueOld;
    });

    // Sort older tasks by priority and due date
    const sortedOlderTasks = olderPendingTasks.sort((a: any, b: any) => {
      // First sort by priority
      const priorityOrder = { 'high': 1, 'medium': 2, 'low': 3 };
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 4;
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 4;
      
      if (aPriority !== bPriority) return aPriority - bPriority;
      
      // Then by due date (overdue first)
      if (a.dueDate && b.dueDate) {
        const aDate = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
        const bDate = b.dueDate?.toDate ? b.dueDate.toDate() : new Date(b.dueDate);
        return aDate.getTime() - bDate.getTime();
      }
      
      return a.dueDate ? -1 : 1; // Tasks with due dates first
    });

    // HIGH PRIORITY TASKS needing attention
    const highPriorityPending = tasks.filter((task: any) => 
      !task.completedAt && task.priority === 'high'
    );

    // UPCOMING FOCUS - Next 7 days
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingTasks = tasks.filter((task: any) => {
      if (!task.dueDate || task.completedAt) return false;
      const dueDate = task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
      return dueDate >= now && dueDate <= nextWeek;
    });

    // SIMPLE PRODUCTIVITY INSIGHTS
    const getWeeklyInsight = () => {
      const completedCount = thisWeekCompleted.length;
      const olderTasksCount = olderPendingTasks.length;
      
      if (olderTasksCount > 10) {
        return `You have ${olderTasksCount} tasks that have been pending for over a week. Consider dedicating time this week to clear your backlog! 🧹`;
      } else if (olderTasksCount > 5) {
        return `${olderTasksCount} older tasks need attention. Tackling a few of these will give you a great sense of progress! 💪`;
      } else if (completedCount === 0) {
        return "This week is a fresh start! Pick one important task and make it happen! 🌟";
      } else if (completedCount >= 10) {
        return "Incredible week! You're absolutely crushing your goals! Keep this momentum going! 🚀";
      } else if (completedCount >= 5) {
        return "Solid week of progress! You're building great habits! 🎯";
      } else {
        return "Every completed task matters! You're making steady progress! ✨";
      }
    };

    // FOCUS RECOMMENDATION for the upcoming week
    const getFocusRecommendation = () => {
      if (olderPendingTasks.length > 5) {
        return "🎯 Focus Priority: Clear 3-5 older tasks this week to reduce your backlog and gain momentum!";
      } else if (highPriorityPending.length > 3) {
        return "🔥 Focus Priority: You have several high-priority tasks. Tackle these first for maximum impact!";
      } else if (upcomingTasks.length > 8) {
        return "📅 Focus Priority: Busy week ahead! Consider time-blocking your schedule for better organization.";
      } else {
        return "🌟 Focus Priority: Great opportunity to tackle strategic work or learn something new!";
      }
    };

    return {
      weekPeriod: `${oneWeekAgo.toLocaleDateString()} - ${now.toLocaleDateString()}`,
      
      // Key Weekly Metrics (Simplified)
      thisWeekCompleted: thisWeekCompleted.length,
      totalActiveTasks,
      overallCompletionRate,
      
      // Focus Areas
      olderPendingTasks: sortedOlderTasks.slice(0, 10), // Top 10 older tasks
      olderTasksCount: olderPendingTasks.length,
      highPriorityCount: highPriorityPending.length,
      upcomingTasksCount: upcomingTasks.length,
      
      // Top Achievements (for motivation)
      topAchievements: thisWeekCompleted.slice(0, 5), // Top 5 achievements
      
      // Insights & Recommendations
      weeklyInsight: getWeeklyInsight(),
      focusRecommendation: getFocusRecommendation(),
      
      // Additional context
      hasOlderTasks: olderPendingTasks.length > 0,
    };
  } catch (error) {
    console.error('Error getting weekly stats:', error);
    return {
      weekPeriod: `${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString()} - ${new Date().toLocaleDateString()}`,
      thisWeekCompleted: 0,
      totalActiveTasks: 0,
      overallCompletionRate: 0,
      olderPendingTasks: [],
      olderTasksCount: 0,
      highPriorityCount: 0,
      upcomingTasksCount: 0,
      topAchievements: [],
      weeklyInsight: "Unable to load insights this week. Keep going! 🌟",
      focusRecommendation: "Focus on what matters most! You've got this! 💪",
      hasOlderTasks: false,
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

  return maxStreak;
}

function generateWeeklyDigestTemplate(data: any): string {
  const companyName = data.companyName || 'MindMate';
  const companyUrl = data.companyUrl || 'https://mindmate.app';
  
  // Older pending tasks list (key feature)
  const olderTasksList = data.olderPendingTasks.map((task: any) => {
    const daysSinceCreated = Math.floor((Date.now() - (task.createdAt?.toDate ? task.createdAt.toDate() : new Date(task.createdAt)).getTime()) / (1000 * 60 * 60 * 24));
    const isOverdue = task.dueDate && new Date(task.dueDate?.toDate ? task.dueDate.toDate() : task.dueDate) < new Date();
    
    return `<li style="margin: 8px 0; padding: 12px; background: ${isOverdue ? '#fef2f2' : '#fefbeb'}; border-radius: 6px; border-left: 3px solid ${isOverdue ? '#dc2626' : '#f59e0b'};">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div style="flex: 1;">
          <strong>${isOverdue ? '⚠️ ' : ''}${task.title}</strong>
          ${task.priority ? `<span style="color: ${task.priority === 'high' ? '#dc2626' : task.priority === 'medium' ? '#f59e0b' : '#10b981'}; font-size: 12px; margin-left: 8px; font-weight: bold;">[${task.priority.toUpperCase()}]</span>` : ''}
          <br><small style="color: #6b7280;">
            Pending for ${daysSinceCreated} days
            ${task.dueDate ? ` • ${isOverdue ? 'Overdue' : 'Due'}: ${new Date(task.dueDate?.toDate ? task.dueDate.toDate() : task.dueDate).toLocaleDateString()}` : ''}
          </small>
        </div>
      </div>
    </li>`;
  }).join('');

  // Top achievements list
  const achievementsList = data.topAchievements.map((task: any) => 
    `<li style="margin: 5px 0; padding: 10px; background: #f0f9ff; border-radius: 6px; border-left: 3px solid #10b981;">
      <strong>✅ ${task.title}</strong>
      ${task.priority ? `<span style="color: ${task.priority === 'high' ? '#dc2626' : task.priority === 'medium' ? '#f59e0b' : '#10b981'}; font-size: 12px; margin-left: 8px;">[${task.priority.toUpperCase()}]</span>` : ''}
      ${task.completedAt ? `<br><small style="color: #6b7280;">Completed: ${new Date(task.completedAt?.toDate ? task.completedAt.toDate() : task.completedAt).toLocaleDateString()}</small>` : ''}
    </li>`
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
        .section { margin: 25px 0; padding: 20px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #10b981; }
        .section-title { font-size: 18px; font-weight: bold; color: #1f2937; margin-bottom: 15px; }
        .task-list { list-style: none; padding: 0; margin: 10px 0; }
        .older-tasks-section { background: linear-gradient(135deg, #fef3c7 0%, #fef2f2 100%); border-left: 4px solid #f59e0b; }
        .achievements-section { background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-left: 4px solid #10b981; }
        .insight-box { background: linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0; font-weight: 500; }
        .focus-box { background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #1f2937; padding: 20px; border-radius: 10px; margin: 20px 0; font-weight: 500; }
        .button { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .priority-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 15px 0; }
        .priority-card { text-align: center; padding: 10px; border-radius: 6px; background: #f9fafb; }
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

            <!-- Key Weekly Stats (Simplified) -->
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${data.thisWeekCompleted}</div>
                    <div class="stat-label">Completed This Week</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${data.overallCompletionRate}%</div>
                    <div class="stat-label">Overall Progress</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${data.totalActiveTasks}</div>
                    <div class="stat-label">Active Tasks</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${data.olderTasksCount}</div>
                    <div class="stat-label">Need Attention</div>
                </div>
            </div>

            <!-- Weekly Insight -->
            <div class="insight-box">
                <strong>💡 ${data.weeklyInsight}</strong>
            </div>

            <!-- Focus Recommendation -->
            <div class="focus-box">
                <strong>${data.focusRecommendation}</strong>
            </div>

            <!-- Older Pending Tasks (Key Feature) -->
            ${data.hasOlderTasks ? `
            <div class="section older-tasks-section">
                <div class="section-title">🕐 Tasks Needing Attention (${data.olderTasksCount} pending for 7+ days)</div>
                <p style="color: #6b7280; font-size: 14px; margin-bottom: 15px;">
                    These tasks have been pending for over a week. Clearing a few of these will give you great momentum!
                </p>
                <ul class="task-list">
                    ${olderTasksList}
                </ul>
                ${data.olderTasksCount > 10 ? '<p><small style="color: #6b7280;">...and more in your dashboard. Consider scheduling time to review these.</small></p>' : ''}
            </div>
            ` : `
            <div class="section achievements-section">
                <div class="section-title">🌟 Great Job!</div>
                <p>You don't have any tasks pending for over a week. You're staying on top of things! 🎉</p>
            </div>
            `}

            <!-- This Week's Achievements -->
            ${data.thisWeekCompleted > 0 ? `
            <div class="section achievements-section">
                <div class="section-title">🏆 This Week's Achievements</div>
                <ul class="task-list">
                    ${achievementsList}
                </ul>
                ${data.thisWeekCompleted > 5 ? '<p><small style="color: #6b7280;">...and more in your completed tasks history</small></p>' : ''}
            </div>
            ` : ''}

            <!-- Quick Stats Summary -->
            <div class="section">
                <div class="section-title">📈 Quick Overview</div>
                <div class="priority-grid">
                    <div class="priority-card">
                        <div style="font-size: 18px; font-weight: bold; color: #dc2626;">${data.highPriorityCount}</div>
                        <div style="font-size: 12px; color: #666;">High Priority</div>
                    </div>
                    <div class="priority-card">
                        <div style="font-size: 18px; font-weight: bold; color: #3b82f6;">${data.upcomingTasksCount}</div>
                        <div style="font-size: 12px; color: #666;">Due Next Week</div>
                    </div>
                    <div class="priority-card">
                        <div style="font-size: 18px; font-weight: bold; color: #10b981;">${data.thisWeekCompleted}</div>
                        <div style="font-size: 12px; color: #666;">Completed</div>
                    </div>
                </div>
            </div>

            <p style="text-align: center;">
                <a href="${companyUrl}" class="button">Open ${companyName}</a>
                <a href="${companyUrl}/boards" class="button">View Boards</a>
            </p>

            <p>Here's to another productive week ahead! 🚀</p>
            
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

function generateWeeklyDigestText(data: any): string {
  const companyName = data.companyName || 'MindMate';
  const companyUrl = data.companyUrl || 'https://mindmate.app';
  
  // Older pending tasks (key feature for text version)
  const olderTasksList = data.olderPendingTasks.map((task: any) => {
    const daysSinceCreated = Math.floor((Date.now() - (task.createdAt?.toDate ? task.createdAt.toDate() : new Date(task.createdAt)).getTime()) / (1000 * 60 * 60 * 24));
    const isOverdue = task.dueDate && new Date(task.dueDate?.toDate ? task.dueDate.toDate() : task.dueDate) < new Date();
    return `• ${isOverdue ? '⚠️ ' : ''}${task.title} (pending ${daysSinceCreated} days)${task.priority ? ` [${task.priority.toUpperCase()}]` : ''}`;
  }).join('\n');

  // This week's achievements
  const achievementsList = data.topAchievements.map((task: any) => 
    `• ✅ ${task.title}${task.priority ? ` [${task.priority.toUpperCase()}]` : ''}`
  ).join('\n');

  return `
Your Weekly Summary - ${companyName}
${data.weekPeriod}

Hello ${data.userName}!

📊 WEEKLY OVERVIEW
• Completed This Week: ${data.thisWeekCompleted}
• Overall Progress: ${data.overallCompletionRate}%
• Active Tasks: ${data.totalActiveTasks}
• Tasks Needing Attention: ${data.olderTasksCount}

💡 ${data.weeklyInsight}

${data.focusRecommendation}

${data.hasOlderTasks ? `
🕐 TASKS NEEDING ATTENTION (${data.olderTasksCount} pending for 7+ days)
These tasks have been pending for over a week. Clearing a few will give you great momentum!

${olderTasksList}
${data.olderTasksCount > 10 ? '...and more in your dashboard. Consider scheduling time to review these.' : ''}
` : `
🌟 GREAT JOB!
You don't have any tasks pending for over a week. You're staying on top of things! 🎉
`}

${data.thisWeekCompleted > 0 ? `
🏆 THIS WEEK'S ACHIEVEMENTS
${achievementsList}
${data.thisWeekCompleted > 5 ? '...and more in your completed tasks history' : ''}
` : ''}

📈 QUICK OVERVIEW
• High Priority: ${data.highPriorityCount}
• Due Next Week: ${data.upcomingTasksCount}
• Completed: ${data.thisWeekCompleted}

Open ${companyName}: ${companyUrl}
View Boards: ${companyUrl}/boards

Here's to another productive week ahead! 🚀

Best regards,
The ${companyName} Team

Manage preferences: ${companyUrl}/settings
  `;
}

// API Routes
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userEmail, forceToday } = body;

    if (userEmail) {
      // Send digest to specific user
      const result = await sendWeeklyDigestForUser(userEmail);
      return NextResponse.json(result);
    } else {
      // Send digests to all eligible users
      const result = await sendWeeklyDigestForAllUsers(forceToday);
      return NextResponse.json(result);
    }
  } catch (error) {
    console.error('Error in weekly digest endpoint:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userEmail = url.searchParams.get('userEmail');
    const force = url.searchParams.get('force') === 'true';

    if (userEmail) {
      // Send digest to specific user
      const result = await sendWeeklyDigestForUser(userEmail);
      return NextResponse.json(result);
    } else {
      // Send digests to all eligible users
      const result = await sendWeeklyDigestForAllUsers(force);
      return NextResponse.json(result);
    }
  } catch (error) {
    console.error('Error in weekly digest endpoint:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
