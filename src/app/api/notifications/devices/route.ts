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

// GET - Get all devices for a user
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const userEmail = authHeader?.replace('Bearer ', '');

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getFirestore();

    // Get all push subscriptions for this user
    const subscriptionsSnapshot = await db
      .collection('pushSubscriptions')
      .where('userEmail', '==', userEmail)
      .get();

    const devices = subscriptionsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        userAgent: data.deviceInfo?.userAgent || 'Unknown',
        platform: data.deviceInfo?.platform || 'Unknown',
        createdAt: data.createdAt?._seconds ? data.createdAt._seconds * 1000 : Date.now(),
      };
    });

    return NextResponse.json({
      success: true,
      devices
    });

  } catch (error: any) {
    console.error('Error fetching devices:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Remove a specific device subscription
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const userEmail = authHeader?.replace('Bearer ', '');

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { deviceId } = body;

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Missing deviceId' },
        { status: 400 }
      );
    }

    const db = getFirestore();

    // Verify the subscription belongs to this user before deleting
    const subscriptionDoc = await db
      .collection('pushSubscriptions')
      .doc(deviceId)
      .get();

    if (!subscriptionDoc.exists) {
      return NextResponse.json(
        { error: 'Device subscription not found' },
        { status: 404 }
      );
    }

    const subscriptionData = subscriptionDoc.data();
    if (subscriptionData?.userEmail !== userEmail) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this device' },
        { status: 403 }
      );
    }

    // Delete the subscription
    await db.collection('pushSubscriptions').doc(deviceId).delete();

    return NextResponse.json({
      success: true,
      message: 'Device subscription removed successfully'
    });

  } catch (error: any) {
    console.error('Error removing device:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
