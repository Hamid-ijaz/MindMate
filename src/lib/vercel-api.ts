/**
 * Client-side helper functions to call Vercel API endpoints
 * This replaces Firebase callable functions
 */

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-vercel-app.vercel.app' 
  : 'http://localhost:3000';

/**
 * Send a task reminder notification
 * Replaces the Firebase callable function
 */
export async function sendTaskReminder(taskId: string, userId: string, title: string, message: string, authToken?: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/notifications/send-task-reminder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      },
      body: JSON.stringify({
        taskId,
        userId,
        title,
        message
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to send task reminder');
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending task reminder:', error);
    throw error;
  }
}

/**
 * Check for overdue tasks for a specific user
 */
export async function checkOverdueTasks(userId: string, authToken?: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/notifications/check-overdue-tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      },
      body: JSON.stringify({
        userId
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to check overdue tasks');
    }

    return await response.json();
  } catch (error) {
    console.error('Error checking overdue tasks:', error);
    throw error;
  }
}

/**
 * Manually trigger overdue task check for all users
 * This is typically called by cron jobs or admin functions
 */
export async function triggerOverdueCheck(authToken?: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/notifications/trigger-overdue-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to trigger overdue check');
    }

    return await response.json();
  } catch (error) {
    console.error('Error triggering overdue check:', error);
    throw error;
  }
}

/**
 * Health check for the API endpoints
 */
export async function healthCheck() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/notifications/check-overdue-tasks?userId=health-check`, {
      method: 'GET',
    });

    return {
      status: response.status,
      ok: response.ok,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Health check failed:', error);
    return {
      status: 0,
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}
