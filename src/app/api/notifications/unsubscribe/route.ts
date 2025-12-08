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
    const { userEmail, subscriptionId } = body;

    if (!userEmail) {
      return NextResponse.json(
        { error: 'Missing required field: userEmail' },
        { status: 400 }
      );
    }

    const db = getFirestore();
    
    if (subscriptionId) {
      // Unsubscribe specific subscription
      await db.collection('pushSubscriptions')
        .doc(subscriptionId)
        .update({ isActive: false, unsubscribedAt: new Date() });
      
      console.log(`Push subscription ${subscriptionId} unsubscribed for user ${userEmail}`);
    } else {
      // Unsubscribe all subscriptions for the user
      const subscriptionsSnapshot = await db.collection('pushSubscriptions')
        .where('userEmail', '==', userEmail)
        .where('isActive', '==', true)
        .get();

      const batch = db.batch();
      subscriptionsSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { isActive: false, unsubscribedAt: new Date() });
      });
      await batch.commit();
      
      console.log(`All push subscriptions unsubscribed for user ${userEmail}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Push subscription(s) unsubscribed successfully'
    });

  } catch (error) {
    console.error('Error in unsubscribe:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
