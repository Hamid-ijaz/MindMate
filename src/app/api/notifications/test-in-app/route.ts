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
    const { userEmail, title, body: messageBody } = body;

    if (!userEmail || !title || !messageBody) {
      return NextResponse.json(
        { error: 'Missing required fields: userEmail, title, body' },
        { status: 400 }
      );
    }

    const db = getFirestore();

    // Create test in-app notification
    const notificationId = `notif_test_${userEmail.replace('@', '_').replace('.', '_')}_${Date.now()}`;
    const notificationData = {
      id: notificationId,
      userEmail,
      title,
      body: messageBody,
      type: 'in_app',
      isRead: false,
      createdAt: new Date(),
      data: {
        type: 'system',
        metadata: {
          isTest: true,
        },
  },
    };
    
    // Save notification to user's notifications subcollection
    await db.collection(`users/${userEmail}/notifications`).doc(notificationId).set(notificationData);
    console.log(`💾 Created test in-app notification: ${notificationId}`);

  return NextResponse.json({
      success: true,
      message: 'Test in-app notification created successfully',
      notificationId,
      userEmail,
      data: notificationData,
    });

  } catch (error) {
    console.error('Error creating test in-app notification:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}