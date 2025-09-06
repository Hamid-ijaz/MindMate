import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { PushSubscriptionDocument } from '@/lib/types';

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
    const db = getFirestore();

    const body = await request.json();
    const { 
      endpoint, 
      keys, 
      userId, 
      userEmail, 
      deviceInfo,
      preferences = { enabled: true, allowedTypes: ['reminders', 'overdue'] }
    } = body;

    // Validate required fields
    if (!endpoint || !keys?.p256dh || !keys?.auth || !userEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: endpoint, keys, userEmail' },
        { status: 400 }
      );
    }

    // Check if subscription already exists
    const existingSubscription = await db.collection('pushSubscriptions')
      .where('endpoint', '==', endpoint)
      .where('userEmail', '==', userEmail)
      .get();

    if (!existingSubscription.empty) {
      // Update existing subscription
      const docId = existingSubscription.docs[0].id;
      const updateData: Partial<PushSubscriptionDocument> = {
        isActive: true,
        lastUsedAt: Date.now(),
        deviceInfo: {
          ...deviceInfo,
          browserName: getUserAgent(deviceInfo?.userAgent)?.browser?.name,
          browserVersion: getUserAgent(deviceInfo?.userAgent)?.browser?.version,
          deviceType: getDeviceType(deviceInfo?.userAgent),
        },
        preferences,
      };
      // also update canonical subscription object for compatibility
      if (endpoint && keys) {
        (updateData as any).subscription = { endpoint, keys } as any;
      }

      await db.collection('pushSubscriptions').doc(docId).update(updateData as any);

      return NextResponse.json({
        success: true,
        message: 'Subscription updated successfully',
        subscriptionId: docId,
      });
    }

    // Create new subscription
    // Build subscription data (use any to allow extra compatibility fields)
    const subscriptionData: any = {
      userId: userEmail, // Use email as consistent identifier
      userEmail,
      endpoint,
      keys,
      isActive: true,
      subscribedAt: Date.now(),
      lastUsedAt: Date.now(),
      deviceInfo: {
        ...deviceInfo,
        browserName: getUserAgent(deviceInfo?.userAgent)?.browser?.name,
        browserVersion: getUserAgent(deviceInfo?.userAgent)?.browser?.version,
        deviceType: getDeviceType(deviceInfo?.userAgent),
      },
      notificationStats: {
        totalSent: 0,
        totalDelivered: 0,
        failureCount: 0,
      },
      preferences,
    };

    // canonical subscription object for web-push
    subscriptionData.subscription = { endpoint, keys };

    const docRef = await db.collection('pushSubscriptions').add(subscriptionData);

    return NextResponse.json({
      success: true,
      message: 'Subscription created successfully',
      subscriptionId: docRef.id,
    });

  } catch (error) {
    console.error('Error managing push subscription:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
  const db = getFirestore();

    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');
    const endpoint = searchParams.get('endpoint');

    if (!userEmail) {
      return NextResponse.json(
        { error: 'Missing required parameter: userEmail' },
        { status: 400 }
      );
    }

    let query = db.collection('pushSubscriptions').where('userEmail', '==', userEmail);
    
    if (endpoint) {
      query = query.where('endpoint', '==', endpoint);
    }

    const subscriptions = await query.get();

    if (subscriptions.empty) {
      return NextResponse.json(
        { error: 'No subscriptions found' },
        { status: 404 }
      );
    }

    // Delete or deactivate subscriptions
    const batch = db.batch();
    subscriptions.docs.forEach(doc => {
      // Mark as inactive instead of deleting for analytics
      batch.update(doc.ref, {
        isActive: false,
        deactivatedAt: Date.now(),
        deactivationReason: 'user_unsubscribed',
      });
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Deactivated ${subscriptions.size} subscription(s)`,
      count: subscriptions.size,
    });

  } catch (error) {
    console.error('Error removing push subscriptions:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
  const db = getFirestore();

    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');

    if (!userEmail) {
      return NextResponse.json(
        { error: 'Missing required parameter: userEmail' },
        { status: 400 }
      );
    }

    const subscriptions = await db.collection('pushSubscriptions')
      .where('userEmail', '==', userEmail)
      .where('isActive', '==', true)
      .get();

    const subscriptionData = subscriptions.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      subscriptions: subscriptionData,
      count: subscriptionData.length,
    });

  } catch (error) {
    console.error('Error fetching push subscriptions:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Helper functions
function getUserAgent(userAgentString?: string) {
  if (!userAgentString) return null;
  
  // Simple user agent parsing - in production, consider using a library like ua-parser-js
  const isChrome = /Chrome/.test(userAgentString);
  const isFirefox = /Firefox/.test(userAgentString);
  const isSafari = /Safari/.test(userAgentString) && !isChrome;
  const isEdge = /Edg/.test(userAgentString);

  let browser = { name: 'unknown', version: 'unknown' };
  
  if (isChrome) {
    const version = userAgentString.match(/Chrome\/([0-9\.]+)/)?.[1];
    browser = { name: 'Chrome', version: version || 'unknown' };
  } else if (isFirefox) {
    const version = userAgentString.match(/Firefox\/([0-9\.]+)/)?.[1];
    browser = { name: 'Firefox', version: version || 'unknown' };
  } else if (isSafari) {
    const version = userAgentString.match(/Version\/([0-9\.]+)/)?.[1];
    browser = { name: 'Safari', version: version || 'unknown' };
  } else if (isEdge) {
    const version = userAgentString.match(/Edg\/([0-9\.]+)/)?.[1];
    browser = { name: 'Edge', version: version || 'unknown' };
  }

  return { browser };
}

function getDeviceType(userAgentString?: string): 'mobile' | 'tablet' | 'desktop' {
  if (!userAgentString) return 'desktop';
  
  const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgentString);
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(userAgentString);
  
  if (isTablet) return 'tablet';
  if (isMobile) return 'mobile';
  return 'desktop';
}
