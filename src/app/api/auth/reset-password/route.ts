import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { userService } from '@/lib/firestore';

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
    const { token, newPassword } = body;

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: 'Token and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Decode token to get email
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
        { error: 'Invalid token format' },
        { status: 400 }
      );
    }

    const db = getFirestore();
    
    // Validate token one more time
    const tokenDoc = await db.collection('passwordResetTokens').doc(decodedToken.email).get();

    if (!tokenDoc.exists) {
      return NextResponse.json(
        { error: 'Token not found' },
        { status: 404 }
      );
    }

    const tokenData = tokenDoc.data();
    
    if (!tokenData) {
      return NextResponse.json(
        { error: 'Token data not found' },
        { status: 404 }
      );
    }
    
    // Check token match with same logic as validate-reset-token
    if (tokenData.token !== token) {
      // Try comparing decoded content if direct comparison fails
      try {
        const providedDecoded = Buffer.from(decodeURIComponent(token), 'base64').toString('utf-8');
        const storedDecoded = Buffer.from(decodeURIComponent(tokenData.token), 'base64').toString('utf-8');
        
        if (providedDecoded !== storedDecoded) {
          return NextResponse.json(
            { error: 'Invalid token' },
            { status: 400 }
          );
        }
      } catch (error) {
        return NextResponse.json(
          { error: 'Invalid token' },
          { status: 400 }
        );
      }
    }

    if (new Date() > tokenData.expiresAt.toDate()) {
      return NextResponse.json(
        { error: 'Token has expired' },
        { status: 400 }
      );
    }

    if (tokenData.used) {
      return NextResponse.json(
        { error: 'Token has already been used' },
        { status: 400 }
      );
    }

    // Update user password
    try {
      await userService.updateUser(decodedToken.email, {
        password: newPassword,
      });

      // Mark token as used
      await db.collection('passwordResetTokens').doc(decodedToken.email).update({
        used: true,
        usedAt: new Date(),
      });

      return NextResponse.json({
        success: true,
        message: 'Password reset successfully',
      });

    } catch (error) {
      console.error('Error updating password:', error);
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in reset password:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
