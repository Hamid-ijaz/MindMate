import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
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
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required field: userId' },
        { status: 400 }
      );
    }

    const db = getFirestore();
    const now = new Date();
    
    // Query for user's overdue tasks
    const overdueTasksSnapshot = await db.collection('tasks')
      .where('userId', '==', userId)
      .where('completed', '==', false)
      .where('dueDate', '<=', now)
      .where('isMuted', '==', false)
      .get();

    const overdueTasks = overdueTasksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      dueDate: doc.data().dueDate?.toDate?.() || doc.data().dueDate
    }));

    // Query for tasks due within next hour (upcoming reminders)
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const upcomingTasksSnapshot = await db.collection('tasks')
      .where('userId', '==', userId)
      .where('completed', '==', false)
      .where('dueDate', '>', now)
      .where('dueDate', '<=', oneHourFromNow)
      .where('isMuted', '==', false)
      .get();

    const upcomingTasks = upcomingTasksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      dueDate: doc.data().dueDate?.toDate?.() || doc.data().dueDate
    }));

    return NextResponse.json({
      success: true,
      userId,
      overdueTasks: {
        count: overdueTasks.length,
        tasks: overdueTasks
      },
      upcomingTasks: {
        count: upcomingTasks.length,
        tasks: upcomingTasks
      },
      checkedAt: now.toISOString()
    });

  } catch (error) {
    console.error('Error in check-overdue-tasks:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Also support GET for testing with userId in query params
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  
  if (!userId) {
    return NextResponse.json(
      { error: 'Missing required query parameter: userId' },
      { status: 400 }
    );
  }

  // Create a mock request with the userId in the body
  const mockRequest = {
    json: async () => ({ userId })
  } as NextRequest;

  return POST(mockRequest);
}
