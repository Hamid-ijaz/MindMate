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
export async function sendTaskReminder(taskId: string, userId: string, authToken?: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sendTaskReminder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        taskId,
        userId,
        authToken, // In a real app, pass the Firebase Auth token here
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
 * Manually trigger overdue task check
 * Useful for testing or admin purposes
 */
export async function triggerOverdueCheck() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/triggerOverdueCheck`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
    const response = await fetch(`${API_BASE_URL}/api/checkOverdueTasks`, {
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
