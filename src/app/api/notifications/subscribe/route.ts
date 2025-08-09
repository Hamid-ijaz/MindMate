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
    const { userEmail, subscription, deviceInfo } = body;

    if (!userEmail || !subscription) {
      return NextResponse.json(
        { error: 'Missing required fields: userEmail, subscription' },
        { status: 400 }
      );
    }

    const db = getFirestore();
    
    // Generate a unique subscription ID based on the endpoint
    const subscriptionId = Buffer.from(subscription.endpoint).toString('base64').slice(-20);
    
    // Create subscription document
    const subscriptionDoc = {
      userEmail,
      subscription,
      deviceInfo: deviceInfo || {},
      isActive: true,
      createdAt: new Date(),
      lastUsed: new Date(),
      subscriptionId
    };

    // Use set with merge to prevent duplicates
    await db.collection('pushSubscriptions')
      .doc(subscriptionId)
      .set(subscriptionDoc, { merge: true });

    // Also set enabled: true in notificationPreferences for this user
    await db.collection('notificationPreferences')
      .doc(userEmail)
      .set({ enabled: true }, { merge: true });

    console.log(`Push subscription created/updated for user ${userEmail}`);

    return NextResponse.json({
      success: true,
      message: 'Push subscription saved successfully',
      subscriptionId
    });

  } catch (error) {
    console.error('Error in subscribe:', error);
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}
