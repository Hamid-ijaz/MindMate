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
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

export async function POST(request: NextRequest) {
  try {

    const body = await request.json().catch(() => ({}));
    const { notificationId, taskId, userEmail } = body || {};

    // Prefer direct update by userEmail + notificationId to avoid collectionGroup queries
    if (!notificationId && !taskId) {
      return NextResponse.json({ error: 'Provide notificationId or taskId' }, { status: 400 });
    }

    const db = getFirestore();

    // If specific notificationId provided, require userEmail to update the direct doc path
    if (notificationId) {
      if (!userEmail) {
        return NextResponse.json({ error: 'notificationId operations require userEmail in body' }, { status: 400 });
      }

      // Direct path: users/{userEmail}/notifications/{notificationId}
      const docRef = db.doc(`users/${userEmail}/notifications/${notificationId}`);
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        return NextResponse.json({ success: true, updated: 0, message: 'No matching notification found' });
      }
      await docRef.update({ isRead: true, readAt: Date.now() });
      return NextResponse.json({ success: true, updated: 1 });
    }

    // If taskId provided, mark all unread notifications related to that task as read
    if (taskId) {
      if (!userEmail) {
        return NextResponse.json({ error: 'taskId operations require userEmail in body' }, { status: 400 });
      }

      const colRef = db.collection(`users/${userEmail}/notifications`);
      const q = colRef.where('relatedTaskId', '==', taskId).where('isRead', '==', false);
      const snap = await q.get();
      if (snap.empty) {
        return NextResponse.json({ success: true, updated: 0, message: 'No unread notifications for this task' });
      }

      const batch = db.batch();
      snap.docs.forEach(d => {
        batch.update(d.ref, { isRead: true, readAt: Date.now() });
      });

      await batch.commit();
      return NextResponse.json({ success: true, updated: snap.size });
    }

    return NextResponse.json({ success: false, message: 'No action taken' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in notifications/dismiss:', error);
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
