import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, endpoint } = body;
    
    // If specific endpoint provided, remove that one
    // Otherwise remove all subscriptions for user
    const subscriptionsRef = collection(db, 'pushSubscriptions');
    let subscriptionQuery;
    
    if (endpoint) {
      subscriptionQuery = query(
        subscriptionsRef,
        where('endpoint', '==', endpoint)
      );
    } else if (userId) {
      subscriptionQuery = query(
        subscriptionsRef,
        where('userId', '==', userId),
        where('isActive', '==', true)
      );
    } else {
      return NextResponse.json(
        { error: 'Either userId or endpoint is required' },
        { status: 400 }
      );
    }
    
    const querySnapshot = await getDocs(subscriptionQuery);
    
    if (querySnapshot.empty) {
      return NextResponse.json(
        { message: 'No subscriptions found to remove' },
        { status: 404 }
      );
    }

    // Mark subscriptions as inactive instead of deleting
    const updatePromises = querySnapshot.docs.map(docSnapshot => 
      updateDoc(doc(db, 'pushSubscriptions', docSnapshot.id), {
        isActive: false,
        unsubscribedAt: new Date(),
      })
    );

    await Promise.all(updatePromises);

    return NextResponse.json({
      success: true,
      message: `Successfully removed ${querySnapshot.docs.length} subscription(s)`,
      count: querySnapshot.docs.length,
    });
  } catch (error) {
    console.error('Error removing push subscription:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to remove subscription',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
