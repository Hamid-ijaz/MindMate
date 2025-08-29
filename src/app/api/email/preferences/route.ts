import { NextRequest, NextResponse } from 'next/server';
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

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userEmail = url.searchParams.get('userEmail');

    if (!userEmail) {
      return NextResponse.json(
        { error: 'userEmail parameter is required' },
        { status: 400 }
      );
    }

    const db = getFirestore();
    const doc = await db.collection('emailPreferences').doc(userEmail).get();

    if (doc.exists) {
      return NextResponse.json({
        success: true,
        preferences: doc.data(),
      });
    } else {
      // Return default preferences
      return NextResponse.json({
        success: true,
        preferences: {
          welcomeEmails: true,
          taskReminders: true,
          shareNotifications: true,
          teamInvitations: true,
          weeklyDigest: true,
          dailyDigest: true,
          marketingEmails: false,
          reminderFrequency: 'immediate',
          digestDay: 'monday',
          dailyDigestTime: '09:00',
          quietHours: {
            enabled: false,
            startTime: '22:00',
            endTime: '08:00',
          },
        },
      });
    }
  } catch (error) {
    console.error('Error getting email preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userEmail, preferences } = body;

    if (!userEmail || !preferences) {
      return NextResponse.json(
        { error: 'userEmail and preferences are required' },
        { status: 400 }
      );
    }

    const db = getFirestore();
    await db.collection('emailPreferences').doc(userEmail).set({
      ...preferences,
      userEmail,
      updatedAt: new Date(),
    }, { merge: true });

    return NextResponse.json({
      success: true,
      message: 'Email preferences updated successfully',
    });
  } catch (error) {
    console.error('Error updating email preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
