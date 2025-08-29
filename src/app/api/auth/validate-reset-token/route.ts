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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { valid: false, message: 'Token is required' },
        { status: 400 }
      );
    }

    // Decode and validate token
    let decodedToken;
    try {
      const decodedData = Buffer.from(decodeURIComponent(token), 'base64').toString('utf-8');
      const parts = decodedData.split(':');
      
      if (parts.length < 3) {
        throw new Error('Invalid token format');
      }
      
      decodedToken = {
        email: parts[0],
        timestamp: parseInt(parts[1]),
        randomStr: parts[2],
      };
    } catch (error) {
      return NextResponse.json(
        { valid: false, message: 'Invalid token format' },
        { status: 400 }
      );
    }

    // Check if token exists in database and is not expired
    const db = getFirestore();
    const tokenDoc = await db.collection('passwordResetTokens').doc(decodedToken.email).get();

    if (!tokenDoc.exists) {
      return NextResponse.json(
        { valid: false, message: 'Token not found' },
        { status: 404 }
      );
    }

    const tokenData = tokenDoc.data();
    
    if (!tokenData) {
      return NextResponse.json(
        { valid: false, message: 'Token data not found' },
        { status: 404 }
      );
    }
    
    // Check if token matches
    // Both tokens should be compared in their original URL-encoded format
    if (tokenData.token !== token) {
      // If direct comparison fails, try comparing decoded content
      try {
        const providedDecoded = Buffer.from(decodeURIComponent(token), 'base64').toString('utf-8');
        const storedDecoded = Buffer.from(decodeURIComponent(tokenData.token), 'base64').toString('utf-8');
        
        // If the decoded content doesn't match either, it's invalid
        if (providedDecoded !== storedDecoded) {
          return NextResponse.json(
            { valid: false, message: 'This reset link is no longer valid. Please request a new password reset.' },
            { status: 400 }
          );
        }
      } catch (error) {
        return NextResponse.json(
          { valid: false, message: 'This reset link is no longer valid. Please request a new password reset.' },
          { status: 400 }
        );
      }
    }

    // Check if token is expired
    const expiresAt = tokenData.expiresAt.toDate();
    const now = new Date();
    
    if (now > expiresAt) {
      return NextResponse.json(
        { valid: false, message: 'Token has expired' },
        { status: 400 }
      );
    }

    // Check if token has already been used
    if (tokenData.used) {
      return NextResponse.json(
        { valid: false, message: 'Token has already been used' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      email: decodedToken.email,
    });

  } catch (error) {
    console.error('Error validating reset token:', error);
    return NextResponse.json(
      { valid: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
