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

export async function GET(request: NextRequest) {

  try {
    // Try to extract userEmail from Authorization header (Bearer <email>)
    let userEmail = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      userEmail = authHeader.replace('Bearer ', '').trim();
    }
    // Fallback to query param if not in header
    if (!userEmail) {
      const { searchParams } = new URL(request.url);
      userEmail = searchParams.get('userEmail');
    }
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Missing required parameter: userEmail' },
        { status: 400 }
      );
    }

    const db = getFirestore();
    
    // Get user's notification preferences
    const preferencesDoc = await db.collection('notificationPreferences')
      .doc(userEmail)
      .get();

    let preferences: any;
    if (preferencesDoc.exists) {
      preferences = preferencesDoc.data();
      // Migrate old key if needed
      if (preferences.overdueReminders !== undefined && preferences.overdueAlerts === undefined) {
        preferences.overdueAlerts = preferences.overdueReminders;
        delete preferences.overdueReminders;
      }
      // Remove reminderTiming if present
      if (preferences.reminderTiming) {
        delete preferences.reminderTiming;
      }
    } else {
      preferences = {
        enabled: false,
        taskReminders: true,
        overdueAlerts: true,
        dailyDigest: true,
        weeklyReport: false,
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00',
        },
        devices: {
          desktop: true,
          mobile: true,
          tablet: true,
        },
        sound: true,
        vibration: true,
      };
    }

    // Get active subscriptions count
    const subscriptionsSnapshot = await db.collection('pushSubscriptions')
      .where('userEmail', '==', userEmail)
      .where('isActive', '==', true)
      .get();

    return NextResponse.json({
      success: true,
      preferences,
      subscriptionsCount: subscriptionsSnapshot.size,
      hasActiveSubscriptions: subscriptionsSnapshot.size > 0
    });

  } catch (error) {
    console.error('Error in get-preferences:', error);
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {

  try {
    // Try to extract userEmail from Authorization header (Bearer <email>)
    let userEmail = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      userEmail = authHeader.replace('Bearer ', '').trim();
    }
    const body = await request.json();
    // Fallback to body if not in header
    if (!userEmail) {
      userEmail = body.userEmail;
    }
    const { preferences } = body;

    if (!userEmail || !preferences) {
      return NextResponse.json(
        { error: 'Missing required fields: userEmail, preferences' },
        { status: 400 }
      );
    }

    const db = getFirestore();
    
    // Update notification preferences
    await db.collection('notificationPreferences')
      .doc(userEmail)
      .set({
        ...preferences,
        userEmail,
        updatedAt: new Date()
      }, { merge: true });

    console.log(`Notification preferences updated for user ${userEmail}`);

    return NextResponse.json({
      success: true,
      message: 'Notification preferences updated successfully',
      preferences
    });

  } catch (error) {
    console.error('Error in update-preferences:', error);
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}
