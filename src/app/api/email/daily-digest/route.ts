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
    
    if (doc.exists) {
      return doc.data();
    }
    
    // Return default preferences if none exist
    return {
      dailyDigest: true,
      weeklyDigest: true,
      taskReminders: true,
      shareNotifications: true,
      teamInvitations: true,
      marketingEmails: false,
      reminderFrequency: 'immediate',
      digestDay: 'monday',
      dailyDigestTime: '09:00', // Default time for daily digest
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
      },
    };
  } catch (error) {
    console.error('Error getting email preferences:', error);
    return null;
  }
}

async function sendDailyDigestForUser(userEmail: string) {
  try {
    // Check if user has daily digest enabled
    const preferences = await getUserEmailPreferences(userEmail);
    if (!preferences?.dailyDigest) {
      return { success: false, message: 'Daily digest not enabled for user' };
    }

    // Check quiet hours
    if (preferences.quietHours?.enabled) {
      const now = new Date();
      const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
      const startTime = preferences.quietHours.startTime;
      const endTime = preferences.quietHours.endTime;
      
      if (startTime && endTime) {
        if ((startTime < endTime && currentTime >= startTime && currentTime <= endTime) ||
            (startTime > endTime && (currentTime >= startTime || currentTime <= endTime))) {
          return { success: false, message: 'Daily digest skipped due to quiet hours' };
        }
      }
    }

    // Get user info
    const user = await userService.getUser(userEmail);
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // Get daily stats
    const dailyStats = await getDailyStatsForUser(userEmail);

    // Generate and send email
    const templateData = {
      userName: user.firstName || 'there',
      userEmail,
      ...dailyStats,
      companyName: process.env.EMAIL_COMPANY_NAME || 'MindMate',
      companyUrl: process.env.EMAIL_COMPANY_URL || 'https://mindmate.app',
      supportEmail: process.env.EMAIL_SUPPORT_EMAIL || 'support@mindmate.app',
    };

    const html = generateDailyDigestTemplate(templateData);
    const text = generateDailyDigestText(templateData);

    const success = await emailService.sendEmail({
      to: userEmail,
      subject: `📅 Daily Summary - ${new Date().toLocaleDateString()}`,
      html,
      text,
    });

    return { 
      success, 
      message: success ? 'Daily digest sent successfully' : 'Failed to send daily digest' 
    };
  } catch (error) {
    console.error('Error sending daily digest:', error);
    return { success: false, message: 'Error sending daily digest' };
  }
}

async function sendDailyDigestForAllUsers(forceToday = false) {
  try {
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    const db = getFirestore();
    
    // Get users who have daily digest enabled
    let query = db.collection('emailPreferences')
      .where('dailyDigest', '==', true);

    // If not forcing, filter by users whose digest time matches current time (within 1 hour window)
    if (!forceToday) {
      const currentHour = now.getHours();
      const timeWindow = [`${currentHour.toString().padStart(2, '0')}:00`];
      
      // Add some flexibility for the time window
      if (currentHour > 0) {
        timeWindow.push(`${(currentHour - 1).toString().padStart(2, '0')}:00`);
      }
      if (currentHour < 23) {
        timeWindow.push(`${(currentHour + 1).toString().padStart(2, '0')}:00`);
      }
      
      query = query.where('dailyDigestTime', 'in', timeWindow);
    }

    const preferencesSnapshot = await query.get();
    
    const results = [];
    
    for (const doc of preferencesSnapshot.docs) {
      const userEmail = doc.id;
      const result = await sendDailyDigestForUser(userEmail);
      results.push({ userEmail, ...result });
    }

    const successCount = results.filter(r => r.success).length;

    return {
      success: true,
      message: `Processed ${results.length} users, ${successCount} digests sent successfully`,
      results,
    };
  } catch (error) {
    console.error('Error sending daily digests:', error);
    return { success: false, message: 'Error sending daily digests' };
  }
}

async function getDailyStatsForUser(userEmail: string) {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    
    // Tomorrow's range
    const startOfTomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    startOfTomorrow.setHours(0, 0, 0, 0);
    const endOfTomorrow = new Date(startOfTomorrow.getTime() + 24 * 60 * 60 * 1000 - 1);

    // Get all tasks for the user
    const tasks = await taskService.getTasks(userEmail);
    
    // TODAY'S ACHIEVEMENTS - Tasks completed today
    const todaysAchievements = tasks.filter((task: any) => {
      if (!task.completedAt) return false;
      const completedAt = task.completedAt?.toDate ? task.completedAt.toDate() : new Date(task.completedAt);
      return completedAt >= startOfDay && completedAt <= endOfDay;
    });

    // TODAY'S SCHEDULED TASKS - Tasks that were due today
    const todaysScheduledTasks = tasks.filter((task: any) => {
      if (!task.dueDate) return false;
      const dueDate = task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
      return dueDate >= startOfDay && dueDate <= endOfDay;
    });

    // TODAY'S PENDING - Tasks scheduled for today but not completed
    const todaysPendingTasks = todaysScheduledTasks.filter((task: any) => !task.completed);

    // TOMORROW'S SCHEDULE - Tasks scheduled for tomorrow
    const tomorrowsSchedule = tasks.filter((task: any) => {
      if (!task.dueDate || task.completed) return false;
      const dueDate = task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
      return dueDate >= startOfTomorrow && dueDate <= endOfTomorrow;
    });

    // OVERDUE TASKS - Tasks that were due before today and not completed
    const overdueTasks = tasks.filter((task: any) => {
      if (!task.dueDate || task.completed) return false;
      const dueDate = task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
      return dueDate < startOfDay;
    });

    // HIGH PRIORITY PENDING TASKS
    const highPriorityPending = tasks.filter((task: any) => 
      !task.completed && task.priority === 'high'
    );

    // Calculate meaningful metrics
    const todaysCompletionRate = todaysScheduledTasks.length > 0 ? 
      Math.round((todaysAchievements.length / todaysScheduledTasks.length) * 100) : 0;

    // Get achievements by priority for motivation
    const achievementsByPriority = {
      high: todaysAchievements.filter((task: any) => task.priority === 'high').length,
      medium: todaysAchievements.filter((task: any) => task.priority === 'medium').length,
      low: todaysAchievements.filter((task: any) => task.priority === 'low').length,
    };

    // Smart motivational message based on actual performance
    const getSmartMotivationalMessage = () => {
      const achievementCount = todaysAchievements.length;
      const highPriorityAchievements = achievementsByPriority.high;
      
      if (achievementCount === 0 && todaysScheduledTasks.length === 0) {
        return "No tasks scheduled for today - perfect time to plan ahead or tackle something from your backlog! 📝";
      } else if (achievementCount === 0 && todaysScheduledTasks.length > 0) {
        return "The day is young! Start with your highest priority task to build momentum! 🚀";
      } else if (todaysCompletionRate === 100) {
        return "🎉 Perfect day! You completed everything you set out to do. You're on fire!";
      } else if (todaysCompletionRate >= 80) {
        return "🌟 Excellent work! You're crushing your daily goals with style!";
      } else if (highPriorityAchievements > 0) {
        return "💪 Great job tackling high-priority tasks! That's how you make real progress!";
      } else if (achievementCount >= 3) {
        return "🎯 Solid progress today! You're building great momentum!";
      } else {
        return "✨ Every completed task is a victory! Keep the momentum going!";
      }
    };

    // Tomorrow preparation insight
    const getTomorrowInsight = () => {
      if (tomorrowsSchedule.length === 0) {
        return "Tomorrow's schedule is clear - perfect opportunity to tackle overdue items or plan new goals!";
      } else if (tomorrowsSchedule.length > 5) {
        return `Busy day tomorrow with ${tomorrowsSchedule.length} scheduled tasks. Consider time-blocking your calendar!`;
      } else if (tomorrowsSchedule.some((task: any) => task.priority === 'high')) {
        return "You have high-priority tasks tomorrow - great time to prepare and set yourself up for success!";
      } else {
        return `${tomorrowsSchedule.length} tasks scheduled for tomorrow. You've got this! 🎯`;
      }
    };

    return {
      date: now.toLocaleDateString(),
      // Today's Performance
      todaysAchievements: todaysAchievements.slice(0, 8), // Show up to 8 achievements
      todaysAchievementCount: todaysAchievements.length,
      todaysScheduledCount: todaysScheduledTasks.length,
      todaysCompletionRate,
      achievementsByPriority,
      
      // Today's Remaining Work
      todaysPendingTasks: todaysPendingTasks.slice(0, 5),
      todaysPendingCount: todaysPendingTasks.length,
      
      // Tomorrow's Preparation
      tomorrowsSchedule: tomorrowsSchedule.slice(0, 6), // Show top 6 for tomorrow
      tomorrowsTaskCount: tomorrowsSchedule.length,
      tomorrowInsight: getTomorrowInsight(),
      
      // Important Alerts
      overdueTaskCount: overdueTasks.length,
      highPriorityPendingCount: highPriorityPending.length,
      overdueTasks: overdueTasks.slice(0, 3), // Show top 3 overdue for attention
      
      // Motivation & Insights
      motivationalMessage: getSmartMotivationalMessage(),
      totalActiveTasks: tasks.filter((task: any) => !task.completed).length,
    };
  } catch (error) {
    console.error('Error getting daily stats:', error);
    return {
      date: new Date().toLocaleDateString(),
      todaysAchievements: [],
      todaysAchievementCount: 0,
      todaysScheduledCount: 0,
      todaysCompletionRate: 0,
      achievementsByPriority: { high: 0, medium: 0, low: 0 },
      todaysPendingTasks: [],
      todaysPendingCount: 0,
      tomorrowsSchedule: [],
      tomorrowsTaskCount: 0,
      tomorrowInsight: "Unable to load tomorrow's schedule",
      overdueTaskCount: 0,
      highPriorityPendingCount: 0,
      overdueTasks: [],
      motivationalMessage: "Keep going! Every day is a new opportunity! 🌟",
      totalActiveTasks: 0,
    };
  }
}

function generateDailyDigestTemplate(data: any): string {
  const companyName = data.companyName || 'MindMate';
  const companyUrl = data.companyUrl || 'https://mindmate.app';
  
  // Today's achievements list
  const achievementsList = (data.todaysAchievements || []).map((task: any) => 
    `<li style="margin: 5px 0; padding: 10px; background: #f0f9ff; border-radius: 6px; border-left: 3px solid #10b981;">
      <strong>✅ ${task.title}</strong>
      ${task.priority ? `<span style="color: ${task.priority === 'high' ? '#dc2626' : task.priority === 'medium' ? '#f59e0b' : '#10b981'}; font-size: 12px; margin-left: 8px;">[${task.priority.toUpperCase()}]</span>` : ''}
      ${task.completedAt ? `<br><small style="color: #6b7280;">Completed: ${new Date(task.completedAt).toLocaleTimeString()}</small>` : ''}
    </li>`
  ).join('');

  // Today's remaining tasks
  const todaysPendingList = (data.todaysPendingTasks || []).map((task: any) => 
    `<li style="margin: 5px 0; padding: 10px; background: #fef3c7; border-radius: 6px; border-left: 3px solid #f59e0b;">
      <strong>${task.title}</strong>
      ${task.priority ? `<span style="color: ${task.priority === 'high' ? '#dc2626' : task.priority === 'medium' ? '#f59e0b' : '#10b981'}; font-size: 12px; margin-left: 8px;">[${task.priority.toUpperCase()}]</span>` : ''}
      ${task.dueDate ? `<br><small style="color: #f59e0b;">Due: ${new Date(task.dueDate).toLocaleTimeString()}</small>` : ''}
    </li>`
  ).join('');

  // Tomorrow's schedule
  const tomorrowsList = (data.tomorrowsSchedule || []).map((task: any) => 
    `<li style="margin: 5px 0; padding: 10px; background: #ecfdf5; border-radius: 6px; border-left: 3px solid #10b981;">
      <strong>${task.title}</strong>
      ${task.priority ? `<span style="color: ${task.priority === 'high' ? '#dc2626' : task.priority === 'medium' ? '#f59e0b' : '#10b981'}; font-size: 12px; margin-left: 8px;">[${task.priority.toUpperCase()}]</span>` : ''}
      ${task.dueDate ? `<br><small style="color: #10b981;">Scheduled: ${new Date(task.dueDate).toLocaleTimeString()}</small>` : ''}
    </li>`
  ).join('');

  // Overdue tasks (top 3)
  const overdueList = data.overdueTasks.map((task: any) => 
    `<li style="margin: 5px 0; padding: 10px; background: #fef2f2; border-radius: 6px; border-left: 3px solid #dc2626;">
      <strong>⚠️ ${task.title}</strong>
      ${task.priority ? `<span style="color: #dc2626; font-size: 12px; margin-left: 8px;">[${task.priority.toUpperCase()}]</span>` : ''}
      ${task.dueDate ? `<br><small style="color: #dc2626;">Due: ${new Date(task.dueDate).toLocaleDateString()}</small>` : ''}
    </li>`
  ).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daily Summary - ${data.date}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat-card { background: #f8f9ff; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #667eea; }
        .stat-number { font-size: 24px; font-weight: bold; color: #667eea; }
        .stat-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
        .section { margin: 25px 0; padding: 20px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #10b981; }
        .section-title { font-size: 18px; font-weight: bold; color: #1f2937; margin-bottom: 15px; }
        .task-list { list-style: none; padding: 0; margin: 10px 0; }
        .achievements-section { background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-left: 4px solid #10b981; }
        .tomorrow-section { background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%); border-left: 4px solid #059669; }
        .motivation-box { background: linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%); color: #2d3436; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0; font-weight: 500; }
        .priority-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 15px 0; }
        .priority-card { text-align: center; padding: 10px; border-radius: 6px; background: #f9fafb; }
        .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .overdue-warning { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 15px; border-radius: 6px; margin: 15px 0; }
        .insight-box { background: #f0f9ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 6px; margin: 15px 0; color: #1e40af; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📅 Daily Summary</h1>
            <p>Your ${companyName} productivity report for ${data.date}</p>
        </div>
        <div class="content">
            <h2>Hello ${data.userName}! 👋</h2>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${data.todaysAchievementCount}</div>
                    <div class="stat-label">Achieved Today</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${data.todaysCompletionRate}%</div>
                    <div class="stat-label">Completion Rate</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${data.todaysPendingCount}</div>
                    <div class="stat-label">Still Pending</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${data.tomorrowsTaskCount}</div>
                    <div class="stat-label">Tomorrow's Plan</div>
                </div>
            </div>

            <div class="motivation-box">
                <strong>💫 ${data.motivationalMessage}</strong>
            </div>

            ${data.todaysAchievementCount > 0 ? `
            <div class="section achievements-section">
                <div class="section-title">🎉 Today's Achievements</div>
                <ul class="task-list">
                    ${achievementsList}
                </ul>
                <div class="priority-grid">
                    <div class="priority-card">
                        <div style="font-size: 18px; font-weight: bold; color: #dc2626;">${data.achievementsByPriority.high}</div>
                        <div style="font-size: 12px; color: #666;">High Priority</div>
                    </div>
                    <div class="priority-card">
                        <div style="font-size: 18px; font-weight: bold; color: #f59e0b;">${data.achievementsByPriority.medium}</div>
                        <div style="font-size: 12px; color: #666;">Medium Priority</div>
                    </div>
                    <div class="priority-card">
                        <div style="font-size: 18px; font-weight: bold; color: #10b981;">${data.achievementsByPriority.low}</div>
                        <div style="font-size: 12px; color: #666;">Low Priority</div>
                    </div>
                </div>
            </div>
            ` : ''}

            ${data.overdueTaskCount > 0 ? `
            <div class="overdue-warning">
                <strong>⚠️ ${data.overdueTaskCount} Overdue Task${data.overdueTaskCount > 1 ? 's' : ''} Need Attention</strong>
                ${data.overdueTasks.length > 0 ? `
                <ul class="task-list" style="margin-top: 10px;">
                    ${overdueList}
                </ul>
                ${data.overdueTaskCount > 3 ? '<p><small>...and more in your dashboard</small></p>' : ''}
                ` : ''}
            </div>
            ` : ''}

            ${data.todaysPendingCount > 0 ? `
            <div class="section">
                <div class="section-title">� Still On Today's List</div>
                <ul class="task-list">
                    ${todaysPendingList}
                </ul>
                ${data.todaysPendingCount > 5 ? '<p><small>...and more in your dashboard</small></p>' : ''}
            </div>
            ` : ''}

            ${data.tomorrowsTaskCount > 0 ? `
            <div class="section tomorrow-section">
                <div class="section-title">🗓️ Tomorrow's Schedule</div>
                <div class="insight-box">
                    <strong>💡 ${data.tomorrowInsight}</strong>
                </div>
                <ul class="task-list">
                    ${tomorrowsList}
                </ul>
                ${data.tomorrowsTaskCount > 6 ? '<p><small>...and more in your dashboard</small></p>' : ''}
            </div>
            ` : data.tomorrowsTaskCount === 0 ? `
            <div class="section tomorrow-section">
                <div class="section-title">�️ Tomorrow's Schedule</div>
                <div class="insight-box">
                    <strong>💡 ${data.tomorrowInsight}</strong>
                </div>
            </div>
            ` : ''}

            <p style="text-align: center;">
                <a href="${companyUrl}" class="button">Open ${companyName}</a>
                <a href="${companyUrl}/timer" class="button">Start Focus Session</a>
            </p>

            <p>Keep up the momentum! 🚀</p>
            
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

function generateDailyDigestText(data: any): string {
  const companyName = data.companyName || 'MindMate';
  const companyUrl = data.companyUrl || 'https://mindmate.app';
  
  const todaysPendingList = (data.todaysPendingTasks || []).map((task: any) => 
    `• ${task.title} ${task.dueDate ? `(Due: ${new Date(task.dueDate).toLocaleString()})` : ''}`
  ).join('\n');

  const tomorrowsTasksList = (data.tomorrowsSchedule || []).map((task: any) => 
    `• ${task.title} ${task.dueDate ? `(Scheduled: ${new Date(task.dueDate).toLocaleString()})` : ''}`
  ).join('\n');

  return `
Your Daily Summary - ${companyName}
${data.date}

Hello ${data.userName}!

Here's your daily productivity summary:

📊 TODAY'S STATS
• Tasks Completed: ${data.todaysAchievementCount || 0}
• Tasks Scheduled: ${data.todaysScheduledCount || 0}
• Completion Rate: ${data.todaysCompletionRate || 0}%
• Total Pending: ${data.todaysPendingCount || 0}

${(data.overdueTaskCount || 0) > 0 ? `⚠️ OVERDUE TASKS: ${data.overdueTaskCount}` : ''}

💫 ${data.motivationalMessage}

${(data.todaysPendingTasks || []).length > 0 ? `
📋 TODAY'S PENDING TASKS
${todaysPendingList}
${(data.todaysPendingTasks || []).length >= 5 ? '...and more in your dashboard' : ''}
` : ''}

${(data.tomorrowsSchedule || []).length > 0 ? `
🗓️ TOMORROW'S SCHEDULE
${tomorrowsTasksList}
${(data.tomorrowsSchedule || []).length >= 5 ? '...and more in your dashboard' : ''}
` : ''}

🎯 PRIORITY BREAKDOWN (Today's Achievements)
• High Priority: ${(data.achievementsByPriority || {}).high || 0}
• Medium Priority: ${(data.achievementsByPriority || {}).medium || 0}
• Low Priority: ${(data.achievementsByPriority || {}).low || 0}

Open ${companyName}: ${companyUrl}
Start Focus Session: ${companyUrl}/timer

Have a productive day ahead!
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
      const result = await sendDailyDigestForUser(userEmail);
      return NextResponse.json(result);
    } else {
      // Send digests to all eligible users
      const result = await sendDailyDigestForAllUsers(forceToday);
      return NextResponse.json(result);
    }
  } catch (error) {
    console.error('Error in daily digest endpoint:', error);
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
      const result = await sendDailyDigestForUser(userEmail);
      return NextResponse.json(result);
    } else {
      // Send digests to all eligible users
      const result = await sendDailyDigestForAllUsers(force);
      return NextResponse.json(result);
    }
  } catch (error) {
    console.error('Error in daily digest endpoint:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
