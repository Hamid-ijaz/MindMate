import { NextRequest, NextResponse } from 'next/server';
import { collection, addDoc, query, where, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAuthenticatedUserEmail, isAuthorizedCronRequest } from '@/lib/auth-utils';

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId?: string;
  userEmail?: string;
  deviceInfo?: {
    userAgent: string;
    platform: string;
    vendor: string;
  };
  subscribedAt?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as PushSubscriptionData;
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    const isCronRequest = isAuthorizedCronRequest(request);

    if (!isCronRequest && !authenticatedUserEmail) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    // Validate required fields
    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json(
        { error: 'Missing required subscription data' },
        { status: 400 }
      );
    }

    const targetUserEmail = body.userEmail || body.userId;
    if (!targetUserEmail) {
      return NextResponse.json(
        { error: 'Missing required user identity' },
        { status: 400 }
      );
    }

    if (!isCronRequest && authenticatedUserEmail !== targetUserEmail) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const userId = targetUserEmail;

    // Check if subscription already exists for this endpoint
    const subscriptionsRef = collection(db, 'pushSubscriptions');
    const existingQuery = query(
      subscriptionsRef,
      where('endpoint', '==', body.endpoint)
    );
    
    const existingDocs = await getDocs(existingQuery);
    
    if (!existingDocs.empty) {
      // Update existing subscription
      const existingDoc = existingDocs.docs[0];
      const docRef = existingDoc.ref;
      
      await updateDoc(docRef, {
        keys: body.keys,
        userId: userId,
        userEmail: targetUserEmail,
        deviceInfo: body.deviceInfo,
        updatedAt: serverTimestamp(),
        isActive: true,
        // also keep canonical subscription object
        subscription: { endpoint: body.endpoint, keys: body.keys },
      });

      return NextResponse.json({
        success: true,
        message: 'Subscription updated successfully',
        id: existingDoc.id,
      });
    } else {
      // Create new subscription
      const subscriptionDoc = {
        endpoint: body.endpoint,
        keys: body.keys,
        userId: userId,
        userEmail: targetUserEmail,
        deviceInfo: body.deviceInfo,
  // canonical subscription object
  subscription: { endpoint: body.endpoint, keys: body.keys },
        subscribedAt: body.subscribedAt ? new Date(body.subscribedAt) : serverTimestamp(),
        createdAt: serverTimestamp(),
        isActive: true,
      };

      const docRef = await addDoc(subscriptionsRef, subscriptionDoc);

      return NextResponse.json({
        success: true,
        message: 'Subscription saved successfully',
        id: docRef.id,
      });
    }
  } catch (error) {
    console.error('Error saving push subscription:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to save subscription',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authenticatedUserEmail = await getAuthenticatedUserEmail(request);
    const isCronRequest = isAuthorizedCronRequest(request);

    if (!isCronRequest && !authenticatedUserEmail) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'UserId is required' },
        { status: 400 }
      );
    }

    if (!isCronRequest && authenticatedUserEmail !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const subscriptionsRef = collection(db, 'pushSubscriptions');
    const userQuery = query(
      subscriptionsRef,
      where('userId', '==', userId),
      where('isActive', '==', true)
    );
    
    const querySnapshot = await getDocs(userQuery);
    const subscriptions = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      subscriptions,
    });
  } catch (error) {
    console.error('Error fetching push subscriptions:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch subscriptions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
